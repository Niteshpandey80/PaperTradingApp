import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SYMBOLS, fetchPrices, fetchTickers, openStream, parseKline, restGet } from '../services/binance.js';
import { CB_PRODUCTS, cbCandlesLatest, cbTicker, openCoinbaseStream } from '../services/coinbase.js';

const Ctx = createContext(null);
export const usePrices = () => useContext(Ctx);

// One shared set of streams feeds live trade ticks + 24h stats for every watchlist symbol.
// Ticks are buffered and flushed 4x per second so React stays smooth.
export function PriceProvider({ children }) {
  const [prices, setPrices] = useState({});
  const [stats, setStats] = useState({});
  const [status, setStatus] = useState('connecting');
  const [dayRefs, setDayRefs] = useState({});
  const priceBuf = useRef({});
  const statBuf = useRef({});

  // Previous daily close + today's high/low (UTC day), exactly what TradingView uses for "change"
  useEffect(() => {
    let dead = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const load = async () => {
      const out = {};
      await Promise.all(SYMBOLS.map(async (id) => {
        try {
          const c = (await restGet(`/api/v3/klines?symbol=${id}&interval=1d&limit=2`)).map(parseKline);
          const today = c[c.length - 1], prev = c.length > 1 ? c[c.length - 2] : null;
          out[id] = { prevClose: prev ? prev.close : today.open, high: today.high, low: today.low };
        } catch { /* keep old value */ }
      }));
      if (!dead) setDayRefs((d) => ({ ...d, ...out }));
      const startOfDay = Math.floor(Date.now() / 86400000) * 86400;
      for (const id of CB_PRODUCTS) {
        if (dead) return;
        try {
          const rows = await cbCandlesLatest(id, '1d');
          const last = rows[rows.length - 1];
          const hasToday = last && last.time >= startOfDay;
          const prev = hasToday ? rows[rows.length - 2] : last;
          if (prev) setDayRefs((d) => ({ ...d, [id]: { prevClose: prev.close, high: hasToday ? last.high : undefined, low: hasToday ? last.low : undefined } }));
        } catch { /* keep old value */ }
        await sleep(150);
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { dead = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    fetchTickers().then((list) => {
      const p = {}, s = {};
      list.forEach((t) => {
        p[t.symbol] = +t.lastPrice;
        s[t.symbol] = { open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice, volume: +t.quoteVolume };
      });
      setPrices((prev) => ({ ...p, ...prev }));
      setStats((prev) => ({ ...s, ...prev }));
    }).catch(() => {});

    const flush = setInterval(() => {
      const pb = priceBuf.current, sb = statBuf.current;
      if (Object.keys(pb).length) { priceBuf.current = {}; setPrices((p) => ({ ...p, ...pb })); }
      if (Object.keys(sb).length) { statBuf.current = {}; setStats((s) => ({ ...s, ...sb })); }
    }, 250);

    const st = { b: 'connecting', c: 'connecting' };
    const update = () => setStatus(
      st.b === 'live' || st.c === 'live' ? 'live' : st.b === 'polling' || st.c === 'polling' ? 'polling' : 'connecting',
    );

    const streams = SYMBOLS.flatMap((s) => [`${s.toLowerCase()}@aggTrade`, `${s.toLowerCase()}@miniTicker`]).join('/');
    const stopB = openStream({
      path: `/stream?streams=${streams}`,
      onStatus: (x) => { st.b = x; update(); },
      onMessage: (m) => {
        const d = m.data;
        if (!d) return;
        if (d.e === 'aggTrade') priceBuf.current[d.s] = +d.p;
        else if (d.e === '24hrMiniTicker') {
          priceBuf.current[d.s] = +d.c;
          statBuf.current[d.s] = { open: +d.o, high: +d.h, low: +d.l, volume: +d.q };
        }
      },
      poll: async () => (await fetchPrices()).forEach((t) => { priceBuf.current[t.symbol] = +t.price; }),
    });

    const stopC = openCoinbaseStream({
      products: CB_PRODUCTS,
      onStatus: (x) => { st.c = x; update(); },
      onTicker: (t) => {
        priceBuf.current[t.product_id] = +t.price;
        if (t.open_24h) statBuf.current[t.product_id] = { open: +t.open_24h, high: +t.high_24h, low: +t.low_24h, volume: +t.volume_24h * +t.price };
      },
      poll: async () => {
        const rows = await Promise.all(CB_PRODUCTS.map((p) => cbTicker(p).catch(() => null)));
        rows.forEach((t, i) => { if (t) priceBuf.current[CB_PRODUCTS[i]] = +t.price; });
      },
    });

    return () => { clearInterval(flush); stopB(); stopC(); };
  }, []);

  // Change vs previous daily close (same as TradingView). Falls back to rolling 24h open.
  const refOf = (sym) => dayRefs[sym]?.prevClose ?? stats[sym]?.open;
  const changeAbs = useCallback((sym) => {
    const o = refOf(sym), p = prices[sym];
    return o && p ? p - o : 0;
  }, [stats, prices, dayRefs]);
  const changeOf = useCallback((sym) => {
    const o = refOf(sym), p = prices[sym];
    return o && p ? ((p - o) / o) * 100 : 0;
  }, [stats, prices, dayRefs]);
  const dayRange = useCallback((sym) => {
    const r = dayRefs[sym], p = prices[sym];
    if (!r || !p) return { high: stats[sym]?.high, low: stats[sym]?.low };
    return { high: Math.max(r.high ?? p, p), low: Math.min(r.low ?? p, p) };
  }, [stats, prices, dayRefs]);

  return <Ctx.Provider value={{ prices, stats, status, changeOf, changeAbs, dayRange }}>{children}</Ctx.Provider>;
}
