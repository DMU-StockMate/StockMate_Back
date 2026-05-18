export function removeComma(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value).replaceAll(',', '');
}

export function parseKrxDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = String(value).replaceAll('/', '').replaceAll('-', '');

  if (date.length !== 8) {
    return null;
  }

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

export function mapKrxStock(row: any, market: string) {
  return {
    ticker: row.ISU_SRT_CD,
    companyName: row.ISU_ABBRV || row.ISU_NM || row.CORP_NM,
    market,
    sector: row.IND_NM || null,
    currency: 'KRW',
    status: 'ACTIVE',
    isActive: true,

    industryDetail: row.IND_NM || null,
    listingDate: parseKrxDate(row.LIST_DD),
    totalShares: removeComma(row.LIST_SHRS),
  };
}

export function mapKrxDailyPrice(row: any) {
  return {
    ticker: row.ISU_SRT_CD || row.ISU_CD,
    tradeDate: parseKrxDate(row.BAS_DD || row.TRD_DD),

    openPrice: removeComma(row.TDD_OPNPRC),
    highPrice: removeComma(row.TDD_HGPRC),
    lowPrice: removeComma(row.TDD_LWPRC),
    closePrice: removeComma(row.TDD_CLSPRC),
    volume: removeComma(row.ACC_TRDVOL),

    marketCap: removeComma(row.MKTCAP),
    totalShares: removeComma(row.LIST_SHRS),
  };
}