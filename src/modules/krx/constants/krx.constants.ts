export const KRX_API_URLS = {
  KOSPI_STOCKS: 'https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info',
  KOSDAQ_STOCKS: 'https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info',

  KOSPI_DAILY_PRICES: 'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd',
  KOSDAQ_DAILY_PRICES: 'https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd',
} as const;

export const KRX_MARKETS = {
  KOSPI: 'KOSPI',
  KOSDAQ: 'KOSDAQ',
} as const;