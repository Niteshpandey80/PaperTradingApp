// Price precision per instrument. Defaults below are replaced by the exact precision
// detected from the exchange's own candles as soon as a chart loads.
const PREC = {};
const DEFAULTS = { BTC: 2, ETH: 2, BNB: 2, SOL: 2, XRP: 4, DOGE: 5, ADA: 4, AVAX: 2, LINK: 3, DOT: 3, LTC: 2, TRX: 5 };
Object.entries(DEFAULTS).forEach(([b, d]) => { PREC[`${b}USDT`] = d; PREC[`${b}-USD`] = d; });

export const setPrecision = (id, p) => { PREC[id] = p; };
export const getPrecision = (id) => PREC[id] ?? 2;

export const fmtPrice = (p, id) => {
  if (p == null || Number.isNaN(p)) return '—';
  const d = id ? PREC[id] : undefined;
  if (d != null) return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
};

export const fmtUsd = (n) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtQty = (q) => (q >= 100 ? q.toFixed(2) : q >= 1 ? q.toFixed(4) : q.toFixed(6));
export const fmtDate = (t) => new Date(t).toLocaleString();
export const pnlClass = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');
