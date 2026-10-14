// One interface over both price sources: Binance (USDT pairs) and Coinbase (USD pairs).
import * as bn from './binance.js';
import * as cb from './coinbase.js';
import { setPrecision } from '../utils/format.js';

const build = (id, ex, base, quote) => ({ id, ex, base, quote, label: `${base}/${quote}` });
export const INSTRUMENTS = [
  ...bn.SYMBOLS.map((id) => build(id, 'binance', id.replace('USDT', ''), 'USDT')),
  ...cb.CB_PRODUCTS.map((id) => build(id, 'coinbase', id.split('-')[0], 'USD')),
];
const BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));

export const inst = (id) => BY_ID[id];
export const baseOf = (id) => BY_ID[id]?.base || id;
export const labelOf = (id) => BY_ID[id]?.label || id;
export const exchangeName = (id) => (BY_ID[id]?.ex === 'coinbase' ? 'Coinbase' : 'Binance');
export const intervalsFor = (id) => (BY_ID[id]?.ex === 'coinbase' ? Object.keys(cb.CB_GRAN) : bn.INTERVALS);
export const periodOf = (id, iv) => (BY_ID[id]?.ex === 'coinbase' ? cb.CB_GRAN[iv] : bn.INTERVAL_SECONDS[iv]);

// Decimal places actually used by the exchange's prices, so the axis never rounds wrongly
function detectPrecision(candles) {
  let m = 2;
  for (const c of candles) {
    for (const v of [c.open, c.high, c.low, c.close]) {
      const s = String(v);
      const i = s.indexOf('.');
      if (i >= 0 && !s.includes('e')) m = Math.max(m, s.length - i - 1);
    }
  }
  return Math.min(m, 8);
}

export async function loadHistory(id, interval) {
  let candles;
  if (BY_ID[id].ex === 'binance') {
    const raw = await bn.restGet(`/api/v3/klines?symbol=${id}&interval=${interval}&limit=1000`);
    candles = raw.map(bn.parseKline);
  } else candles = await cb.cbCandles(id, interval);
  if (!candles.length) throw new Error('No candles returned for this symbol and timeframe.');
  const precision = detectPrecision(candles);
  setPrecision(id, precision);
  return { candles, precision };
}

// onCandle(candle, eventMs)  onTick(price, ms, size)  onStatus(status)
export function openChartStream(id, interval, { onCandle, onTick, onStatus }) {
  if (BY_ID[id].ex === 'binance') {
    const s = id.toLowerCase();
    return bn.openStream({
      path: `/stream?streams=${s}@kline_${interval}/${s}@aggTrade`,
      onStatus,
      onMessage: (m) => {
        const d = m.data;
        if (!d) return;
        if (d.e === 'kline') {
          const k = d.k;
          onCandle({ time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v }, d.E);
        } else if (d.e === 'aggTrade') onTick(+d.p, d.T, 0);
      },
      poll: async () => (await bn.fetchKlinesLatest(id, interval)).forEach((k) => onCandle(k, Date.now() + 1)),
    });
  }
  return cb.openCoinbaseStream({
    products: [id],
    onStatus,
    onTicker: (t) => onTick(+t.price, Date.parse(t.time) || Date.now(), +t.last_size || 0),
    poll: async () => (await cb.cbCandlesLatest(id, interval)).forEach((k) => onCandle(k, Date.now() + 1)),
  });
}
