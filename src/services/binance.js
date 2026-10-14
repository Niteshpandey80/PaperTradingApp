// Market data from Binance's free public API (no key needed).
// Several hosts are tried automatically, and if WebSockets are blocked on your network
// the app falls back to fast REST polling, so the chart keeps moving either way.
const custom = import.meta.env.VITE_REST && import.meta.env.VITE_WS
  ? [{ rest: import.meta.env.VITE_REST, ws: import.meta.env.VITE_WS }] : [];

const HOSTS = [
  ...custom,
  { rest: 'https://api.binance.com', ws: 'wss://stream.binance.com:9443' },
  { rest: 'https://data-api.binance.vision', ws: 'wss://data-stream.binance.vision' },
  { rest: 'https://api.binance.com', ws: 'wss://stream.binance.com:443' },
  { rest: 'https://api1.binance.com', ws: 'wss://stream.binance.com:443' },
  { rest: 'https://api-gcp.binance.com', ws: 'wss://stream.binance.com:443' },
];

export const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'LTCUSDT', 'TRXUSDT',
];

export const INTERVALS = ['1s', '1m', '5m', '15m', '1h', '4h', '1d', '1w'];
export const INTERVAL_SECONDS = { '1s': 1, '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400, '1w': 604800 };

let restIdx = 0;
let wsIdx = 0;

// REST call with automatic host failover
export async function restGet(path) {
  let lastErr;
  for (let i = 0; i < HOSTS.length; i++) {
    const idx = (restIdx + i) % HOSTS.length;
    try {
      const r = await fetch(HOSTS[idx].rest + path);
      if (!r.ok) throw new Error(`HTTP ${r.status}${r.status === 451 ? ' (blocked in your region, try a VPN)' : ''}`);
      const json = await r.json();
      restIdx = idx;
      return json;
    } catch (e) { lastErr = e; }
  }
  throw new Error(`Cannot reach Binance market data: ${lastErr?.message || 'network error'}. Check your internet, VPN or firewall.`);
}

export const parseKline = (k) => ({
  time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5],
});

export async function fetchKlines(symbol, interval, limit = 1000) {
  const raw = await restGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return raw.map(parseKline);
}

export async function fetchKlinesLatest(symbol, interval) {
  const raw = await restGet(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=2`);
  return raw.map(parseKline);
}

export async function fetchTickers() {
  return restGet(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`);
}

export async function fetchPrices() {
  return restGet(`/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`);
}

// Resilient stream: rotates hosts, detects silent/stale sockets, reconnects forever,
// and polls over REST while the socket is down.
//   onMessage(parsedJson)  onStatus('connecting' | 'live' | 'polling')  poll(): async fn
export function openStream({ path, onMessage, onStatus, poll }) {
  let ws, closed = false, got = false, fails = 0, lastMsg = 0;
  let idx = wsIdx, watchdog, retry, pollTimer;

  const startPoll = () => {
    if (pollTimer || !poll) return;
    onStatus('polling');
    poll().catch(() => {});
    pollTimer = setInterval(() => poll().catch(() => {}), 1000);
  };
  const stopPoll = () => { clearInterval(pollTimer); pollTimer = null; };

  const connect = () => {
    if (closed) return;
    got = false;
    onStatus(pollTimer ? 'polling' : 'connecting');
    try { ws = new WebSocket(HOSTS[idx % HOSTS.length].ws + path); }
    catch { idx++; retry = setTimeout(connect, 1000); return; }

    watchdog = setTimeout(() => { if (!got) ws.close(); }, 5000);
    ws.onmessage = (e) => {
      lastMsg = Date.now();
      if (!got) { got = true; fails = 0; wsIdx = idx % HOSTS.length; clearTimeout(watchdog); stopPoll(); onStatus('live'); }
      try { onMessage(JSON.parse(e.data)); } catch { /* ignore bad frame */ }
    };
    ws.onclose = () => {
      clearTimeout(watchdog);
      if (closed) return;
      if (!got) { idx++; fails++; }
      if (!got ? fails >= 2 : true) startPoll();
      retry = setTimeout(connect, got ? 500 : 1200);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
  };

  // Kill sockets that are open but silent
  const stale = setInterval(() => {
    if (got && Date.now() - lastMsg > 15000) { try { ws.close(); } catch { /* noop */ } }
  }, 5000);

  connect();
  return () => {
    closed = true;
    clearTimeout(watchdog); clearTimeout(retry); clearInterval(stale); stopPoll();
    if (ws) { ws.onclose = null; ws.close(); }
  };
}
