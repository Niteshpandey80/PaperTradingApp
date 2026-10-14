// Coinbase Exchange public market data (USD pairs, same feed TradingView shows as COINBASE:BTCUSD).
const REST = 'https://api.exchange.coinbase.com';
const WSURL = 'wss://ws-feed.exchange.coinbase.com';

export const CB_PRODUCTS = [
  'BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD',
  'ADA-USD', 'AVAX-USD', 'LINK-USD', 'DOT-USD', 'LTC-USD',
];
// Timeframes Coinbase supports natively
export const CB_GRAN = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '6h': 21600, '1d': 86400 };

const mapRow = (k) => ({ time: k[0], open: k[3], high: k[2], low: k[1], close: k[4], volume: k[5] });

async function page(product, g, startSec, endSec) {
  const url = `${REST}/products/${product}/candles?granularity=${g}&start=${new Date(startSec * 1000).toISOString()}&end=${new Date(endSec * 1000).toISOString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Coinbase market data error (HTTP ${r.status}). Check your internet or VPN.`);
  return (await r.json()).map(mapRow);
}

export async function cbCandles(product, interval, pages = 3) {
  const g = CB_GRAN[interval];
  let end = Math.floor(Date.now() / 1000);
  const map = new Map();
  for (let i = 0; i < pages; i++) {
    const start = end - 299 * g;
    const rows = await page(product, g, start, end);
    if (!rows.length) break;
    rows.forEach((c) => map.set(c.time, c));
    end = start - 1;
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}

export async function cbCandlesLatest(product, interval) {
  const g = CB_GRAN[interval];
  const now = Math.floor(Date.now() / 1000);
  return (await page(product, g, now - 3 * g, now)).sort((a, b) => a.time - b.time);
}

export async function cbTicker(product) {
  const r = await fetch(`${REST}/products/${product}/ticker`);
  if (!r.ok) throw new Error('ticker');
  return r.json();
}

// Resilient ticker stream with REST polling fallback
export function openCoinbaseStream({ products, onTicker, onStatus, poll }) {
  let ws, closed = false, got = false, retry, watchdog, pollTimer;
  const startPoll = () => {
    if (pollTimer || !poll) return;
    onStatus('polling');
    poll().catch(() => {});
    pollTimer = setInterval(() => poll().catch(() => {}), 2000);
  };
  const stopPoll = () => { clearInterval(pollTimer); pollTimer = null; };

  const connect = () => {
    if (closed) return;
    got = false;
    try { ws = new WebSocket(WSURL); } catch { retry = setTimeout(connect, 2000); return; }
    watchdog = setTimeout(() => { if (!got) ws.close(); }, 6000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', product_ids: products, channels: ['ticker'] }));
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'ticker' && m.price) {
        if (!got) { got = true; clearTimeout(watchdog); stopPoll(); onStatus('live'); }
        onTicker(m);
      }
    };
    ws.onclose = () => {
      clearTimeout(watchdog);
      if (closed) return;
      startPoll();
      retry = setTimeout(connect, got ? 800 : 2500);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  };
  connect();
  return () => {
    closed = true; clearTimeout(retry); clearTimeout(watchdog); stopPoll();
    if (ws) { ws.onclose = null; ws.close(); }
  };
}
