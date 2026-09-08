import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { Stock } from '../../stocks/entities/stock.entity';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import { StockInvestmentIndicator } from '../../stocks/entities/stock-investment-indicator.entity';

@Injectable()
export class DartService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  // corpCode.xml은 수만 개 기업 목록이 담긴 3MB ZIP — 요청마다 다운로드하면 느리므로 메모리에 캐싱
  private corpCodeCache: Map<string, { corpCode: string; corpName: string; stockCode: string }> | null = null;
  private corpCodeCacheExpiresAt = 0; // epoch ms
  private readonly CORP_CODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,
    @InjectRepository(StockInvestmentIndicator)
    private readonly indicatorRepository: Repository<StockInvestmentIndicator>,
  ) {
    this.baseUrl =
      this.configService.get<string>('DART_API_BASE_URL') ??
      'https://opendart.fss.or.kr/api';

    this.apiKey = this.configService.get<string>('DART_API_KEY');
  }

  async buildStockAiContext(
    stockCode: string,
    businessYear: string,
    reportCode: '11011' | '11012' | '11013' | '11014' = '11011',
  ) {
    const corp = await this.findCorpByStockCode(stockCode);

    const financials = await this.getSingleCompanyFinancials({
      corpCode: corp.corpCode,
      businessYear,
      reportCode,
    });

    return {
      stock: {
        stock_code: corp.stockCode,
        corp_code: corp.corpCode,
        corp_name: corp.corpName,
      },
      dart_context: {
        business_year: businessYear,
        report_code: reportCode,
        report_name: this.getReportName(reportCode),
        financials,
      },
    };
  }

  /**
   * DART 재무제표에서 EPS, BPS, ROE, PER, PBR을 계산하고 DB에 저장합니다.
   * businessYear 미지정 시 직전 연도 → 2년 전 순으로 자동 시도합니다.
   */
  async syncIndicators(
    stockCode: string,
    businessYear?: string,
    reportCode: '11011' | '11012' | '11013' | '11014' = '11011',
  ) {
    const currentYear = new Date().getFullYear();
    const yearsToTry = businessYear
      ? [businessYear]
      : [String(currentYear - 1), String(currentYear - 2)];

    let lastError: unknown;
    for (const year of yearsToTry) {
      try {
        return await this.syncIndicatorsForYear(stockCode, year, reportCode);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  private async syncIndicatorsForYear(
    stockCode: string,
    businessYear: string,
    reportCode: '11011' | '11012' | '11013' | '11014',
  ) {
    const corp = await this.findCorpByStockCode(stockCode);

    const financials = await this.getSingleCompanyFinancials({
      corpCode: corp.corpCode,
      businessYear,
      reportCode,
    });

    // 당기순이익: IS/CIS 구분에서 추출
    const rawNetIncome = this.extractFinancialAmount(financials, ['당기순이익'], [
      '법인세차감전',
      '지배주주',
      '비지배주주',
    ]);

    // 자본총계: BS 구분에서 추출
    const rawTotalEquity = this.extractFinancialAmount(financials, ['자본총계'], [
      '지배주주',
      '비지배주주',
    ]);

    const stock = await this.stockRepository.findOne({
      where: { ticker: stockCode },
      relations: { detail: true },
    });
    if (!stock) throw new NotFoundException(`종목을 찾을 수 없습니다: ${stockCode}`);

    const totalShares = this.parseAmount(stock.detail?.totalShares);
    const latestPrice = await this.stockPriceDailyRepository.findOne({
      where: { stockId: stock.stockId },
      order: { tradeDate: 'DESC' },
    });
    const currentPrice = this.parseAmount(latestPrice?.closePrice) ?? 0;

    // DART 재무제표 금액 단위 자동 감지 (백만원 vs 원)
    const scale = this.detectAmountScale(rawTotalEquity, totalShares);
    const netIncome = rawNetIncome !== null ? rawNetIncome * scale : null;
    const totalEquity = rawTotalEquity !== null ? rawTotalEquity * scale : null;

    // 지표 계산
    const eps =
      totalShares !== null && totalShares > 0 && netIncome !== null
        ? netIncome / totalShares
        : null;
    const bps =
      totalShares !== null && totalShares > 0 && totalEquity !== null
        ? totalEquity / totalShares
        : null;
    // ROE는 scale 영향 없음 (분자·분모 동일 scale)
    const roe =
      rawTotalEquity !== null && rawTotalEquity > 0 && rawNetIncome !== null
        ? (rawNetIncome / rawTotalEquity) * 100
        : null;
    const per = eps !== null && eps > 0 && currentPrice > 0 ? currentPrice / eps : null;
    const pbr = bps !== null && bps > 0 && currentPrice > 0 ? currentPrice / bps : null;

    const tradeDate = latestPrice?.tradeDate ?? `${businessYear}-12-31`;

    // Upsert
    let indicator = await this.indicatorRepository.findOne({
      where: { stockId: stock.stockId, tradeDate },
    });
    if (!indicator) {
      indicator = this.indicatorRepository.create({ stockId: stock.stockId, tradeDate });
    }
    indicator.eps = eps !== null ? eps.toFixed(4) : null;
    indicator.bps = bps !== null ? bps.toFixed(4) : null;
    indicator.roe = roe !== null ? roe.toFixed(4) : null;
    indicator.per = per !== null ? per.toFixed(4) : null;
    indicator.pbr = pbr !== null ? pbr.toFixed(4) : null;
    indicator.source = 'DART';

    await this.indicatorRepository.save(indicator);

    return {
      ticker: stockCode,
      corp: corp.corpName,
      businessYear,
      tradeDate,
      scale,
      indicators: { eps, bps, roe, per, pbr },
    };
  }

  /**
   * 종목의 핵심 재무 항목(매출액/영업이익/당기순이익/자산·부채·자본총계)을 요약해 반환합니다.
   * businessYear 미지정 시 직전 연도 → 2년 전 순으로 자동 시도합니다.
   */
  async getFinancialSummary(
    stockCode: string,
    businessYear?: string,
    reportCode: '11011' | '11012' | '11013' | '11014' = '11011',
  ) {
    const currentYear = new Date().getFullYear();
    const yearsToTry = businessYear
      ? [businessYear]
      : [String(currentYear - 1), String(currentYear - 2)];

    let lastError: unknown;
    for (const year of yearsToTry) {
      try {
        return await this.getFinancialSummaryForYear(stockCode, year, reportCode);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  private async getFinancialSummaryForYear(
    stockCode: string,
    businessYear: string,
    reportCode: '11011' | '11012' | '11013' | '11014',
  ) {
    const corp = await this.findCorpByStockCode(stockCode);
    const financials = await this.getSingleCompanyFinancials({
      corpCode: corp.corpCode,
      businessYear,
      reportCode,
    });

    const pick = (include: string[], exclude: string[] = []) =>
      this.extractFinancialAmount(financials, include, exclude);

    return {
      corpName: corp.corpName,
      businessYear,
      reportName: this.getReportName(reportCode),
      매출액: pick(['매출액', '수익(매출액)']),
      영업이익: pick(['영업이익']),
      당기순이익: pick(['당기순이익'], ['지배주주', '비지배주주']),
      자산총계: pick(['자산총계']),
      부채총계: pick(['부채총계']),
      자본총계: pick(['자본총계'], ['지배주주', '비지배주주']),
    };
  }

  /**
   * 종목의 최근 공시 목록을 조회합니다.
   */
  async getDisclosures(stockCode: string, count = 15) {
    const corp = await this.findCorpByStockCode(stockCode);
    const apiKey = this.getApiKey();

    const end = new Date();
    const begin = new Date(end);
    begin.setFullYear(begin.getFullYear() - 1);
    const toYyyymmdd = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const response = await axios.get(`${this.baseUrl}/list.json`, {
      params: {
        crtfc_key: apiKey,
        corp_code: corp.corpCode,
        // bgn_de/end_de를 생략하면 DART가 검색 결과를 아예 반환하지 않는다 (status 013).
        bgn_de: toYyyymmdd(begin),
        end_de: toYyyymmdd(end),
        page_no: 1,
        page_count: count,
        sort: 'date',
        sort_mth: 'desc',
      },
    });

    // '013'은 DART API 규격상 '조회된 데이터가 없습니다'를 의미하므로 빈 목록으로 처리
    if (response.data.status === '013') return [];

    if (response.data.status !== '000') {
      throw new NotFoundException(
        `DART 공시 목록 조회 실패: ${response.data.message}`,
      );
    }

    return (response.data.list as Array<Record<string, string>>).map((item) => ({
      rceptNo: item.rcept_no,
      title: item.report_nm,
      submitter: item.flr_nm,
      receiptDate: item.rcept_dt,
      remark: item.rm,
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
    }));
  }

  private async findCorpByStockCode(stockCode: string) {
    const cache = await this.getCorpCodeCache();
    const found = cache.get(stockCode);

    if (!found) {
      throw new NotFoundException(
        `DART 기업 고유번호를 찾을 수 없습니다. stockCode=${stockCode}`,
      );
    }

    return found;
  }

  private async getCorpCodeCache() {
    const now = Date.now();
    if (this.corpCodeCache && now < this.corpCodeCacheExpiresAt) {
      return this.corpCodeCache;
    }

    const apiKey = this.getApiKey();

    const response = await axios.get(`${this.baseUrl}/corpCode.xml`, {
      params: { crtfc_key: apiKey },
      responseType: 'arraybuffer',
    });

    const zip = new AdmZip(response.data as Buffer);
    const xmlEntry = zip.getEntries().find((e) => e.entryName.endsWith('.xml'));

    if (!xmlEntry) {
      throw new InternalServerErrorException('DART 고유번호 XML 파일을 찾을 수 없습니다.');
    }

    const xml = xmlEntry.getData().toString('utf-8');
    const parsed = await parseStringPromise(xml);
    const list: Array<Record<string, string[]>> = parsed.result.list ?? [];

    const map = new Map<string, { corpCode: string; corpName: string; stockCode: string }>();
    for (const item of list) {
      const code = item.stock_code?.[0];
      if (code) {
        map.set(code, {
          corpCode: item.corp_code[0],
          corpName: item.corp_name[0],
          stockCode: code,
        });
      }
    }

    this.corpCodeCache = map;
    this.corpCodeCacheExpiresAt = now + this.CORP_CODE_CACHE_TTL_MS;

    return map;
  }

  private async getSingleCompanyFinancials(params: {
    corpCode: string;
    businessYear: string;
    reportCode: string;
  }) {
    const apiKey = this.getApiKey();

    const response = await axios.get(
      `${this.baseUrl}/fnlttSinglAcnt.json`,
      {
        params: {
          crtfc_key: apiKey,
          corp_code: params.corpCode,
          bsns_year: params.businessYear,
          reprt_code: params.reportCode,
        },
      },
    );

    if (response.data.status !== '000') {
      throw new NotFoundException(
        `DART 재무정보 조회 실패: ${response.data.message}`,
      );
    }

    return (response.data.list as Array<Record<string, string>>).map((item) => ({
      account_name: item.account_nm,
      statement_name: item.sj_nm,
      current_amount: item.thstrm_amount,
      previous_amount: item.frmtrm_amount,
      before_previous_amount: item.bfefrmtrm_amount,
      currency: item.currency,
    }));
  }

  private extractFinancialAmount(
    items: Array<{ account_name: string; statement_name: string; current_amount: string }>,
    include: string[],
    exclude: string[] = [],
  ): number | null {
    const item = items.find(
      (i) =>
        include.some((kw) => i.account_name.includes(kw)) &&
        !exclude.some((kw) => i.account_name.includes(kw)),
    );
    return item ? this.parseAmount(item.current_amount) : null;
  }

  private parseAmount(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(num) ? num : null;
  }

  /**
   * DART 재무제표 금액 단위를 추정합니다.
   * 대부분의 상장사는 백만원(×1,000,000) 단위로 보고하므로,
   * 원(원) 단위로 환산이 필요합니다.
   *
   * 판단 기준: 자본총계 / 발행주식수가 1원 미만이면 백만원 단위로 간주
   */
  private detectAmountScale(
    rawTotalEquity: number | null,
    totalShares: number | null,
  ): number {
    if (!totalShares || totalShares <= 0 || rawTotalEquity === null || rawTotalEquity <= 0) {
      return 1_000_000; // totalShares 없으면 대부분 대형주 → 백만원 단위 가정
    }
    const rawBps = rawTotalEquity / totalShares;
    // BPS가 1원 미만이지만 ×1M 시 100원 이상이면 백만원 단위
    if (rawBps < 1 && rawBps * 1_000_000 >= 100) return 1_000_000;
    return 1;
  }

  private getApiKey() {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'DART_API_KEY가 설정되지 않았습니다.',
      );
    }

    return this.apiKey;
  }

  private getReportName(reportCode: string) {
    const reportMap = {
      '11011': '사업보고서',
      '11012': '반기보고서',
      '11013': '1분기보고서',
      '11014': '3분기보고서',
    };

    return reportMap[reportCode] ?? '알 수 없음';
  }
}
