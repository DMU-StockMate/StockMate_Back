import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';

@Injectable()
export class DartService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
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

  private async findCorpByStockCode(stockCode: string) {
    const apiKey = this.getApiKey();

    const response = await axios.get(
      `${this.baseUrl}/corpCode.xml`,
      {
        params: {
          crtfc_key: apiKey,
        },
        responseType: 'arraybuffer',
      },
    );

    const zip = new AdmZip(response.data);
    const xmlEntry = zip
      .getEntries()
      .find((entry) => entry.entryName.endsWith('.xml'));

    if (!xmlEntry) {
      throw new InternalServerErrorException(
        'DART 고유번호 XML 파일을 찾을 수 없습니다.',
      );
    }

    const xml = xmlEntry.getData().toString('utf-8');
    const parsed = await parseStringPromise(xml);

    const list = parsed.result.list ?? [];

    const found = list.find(
      (item) => item.stock_code?.[0] === stockCode,
    );

    if (!found) {
      throw new NotFoundException(
        `DART 기업 고유번호를 찾을 수 없습니다. stockCode=${stockCode}`,
      );
    }

    return {
      corpCode: found.corp_code[0],
      corpName: found.corp_name[0],
      stockCode: found.stock_code[0],
    };
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

    return response.data.list.map((item) => ({
      account_name: item.account_nm,
      statement_name: item.sj_nm,
      current_amount: item.thstrm_amount,
      previous_amount: item.frmtrm_amount,
      before_previous_amount: item.bfefrmtrm_amount,
      currency: item.currency,
    }));
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
