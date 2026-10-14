import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { usePrices } from './PriceContext.jsx';
import { loadAccount, saveAccount, emptyAccount } from '../services/storage.js';

const Ctx = createContext(null);
export const useTrading = () => useContext(Ctx);

const uid = () => Math.random().toString(36).slice(2, 10);
const LIQ_LOSS = 0.95; // position is liquidated when 95% of margin is lost

export const pnlOf = (p, price) => (price - p.entry) * p.qty * (p.side === 'long' ? 1 : -1);
export const liqPrice = (side, entry, lev) =>
  side === 'long' ? entry * (1 - LIQ_LOSS / lev) : entry * (1 + LIQ_LOSS / lev);

// Pure engine: checks liquidation / SL / TP on positions and fills limit orders.
// Returns the SAME object when nothing changed so React skips re-rendering.
function runEngine(a, prices) {
  let changed = false;
  let cash = a.cash;
  const positions = [];
  const closed = [];

  for (const p of a.positions) {
    const px = prices[p.symbol];
    if (!px) { positions.push(p); continue; }
    const liq = liqPrice(p.side, p.entry, p.leverage);
    let exit = null, reason = null;
    if (p.side === 'long') {
      if (px <= liq) { exit = liq; reason = 'Liquidated'; }
      else if (p.sl && px <= p.sl) { exit = p.sl; reason = 'Stop Loss'; }
      else if (p.tp && px >= p.tp) { exit = p.tp; reason = 'Take Profit'; }
    } else {
      if (px >= liq) { exit = liq; reason = 'Liquidated'; }
      else if (p.sl && px >= p.sl) { exit = p.sl; reason = 'Stop Loss'; }
      else if (p.tp && px <= p.tp) { exit = p.tp; reason = 'Take Profit'; }
    }
    if (exit != null) {
      const pnl = pnlOf(p, exit);
      cash += Math.max(0, p.margin + pnl);
      closed.push({ ...p, exit, pnl: Math.max(pnl, -p.margin), reason, closedAt: Date.now() });
      changed = true;
    } else positions.push(p);
  }

  const orders = [];
  for (const o of a.orders) {
    const px = prices[o.symbol];
    const hit = px && (o.side === 'long' ? px <= o.price : px >= o.price);
    if (hit) {
      positions.unshift({
        id: uid(), symbol: o.symbol, side: o.side, entry: o.price, qty: (o.margin * o.leverage) / o.price,
        margin: o.margin, leverage: o.leverage, sl: o.sl, tp: o.tp, openedAt: Date.now(), fromOrder: true,
      });
      changed = true;
    } else orders.push(o);
  }

  if (!changed) return a;
  return { ...a, cash, positions, orders, history: [...closed.reverse(), ...a.history].slice(0, 300) };
}

export function TradingProvider({ children }) {
  const { user } = useAuth();
  const { prices } = usePrices();
  const [acct, setAcct] = useState(() => loadAccount(user));
  const [toasts, setToasts] = useState([]);
  const ref = useRef(acct); ref.current = acct;
  const pricesRef = useRef(prices); pricesRef.current = prices;
  const seenHistory = useRef(acct.history[0]?.id);

  useEffect(() => { saveAccount(user, acct); }, [acct, user]);
  useEffect(() => { setAcct((prev) => runEngine(prev, prices)); }, [prices]);

  // Toasts when SL / TP / liquidation fire automatically
  useEffect(() => {
    const fresh = [];
    for (const h of acct.history) { if (h.id === seenHistory.current) break; fresh.push(h); }
    if (fresh.length) {
      seenHistory.current = acct.history[0].id;
      const auto = fresh.filter((h) => ['Stop Loss', 'Take Profit', 'Liquidated'].includes(h.reason));
      if (auto.length) {
        setToasts((t) => [...t, ...auto.map((h) => ({ id: uid(), type: h.pnl >= 0 ? 'up' : 'down',
          text: `${h.reason}: ${h.side.toUpperCase()} ${h.symbol} closed, P&L ${h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)} USD` }))]);
      }
    }
  }, [acct.history]);

  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const validate = ({ side, margin, entry, sl, tp }) => {
    if (!(margin > 0)) throw new Error('Enter an amount.');
    if (margin > ref.current.cash + 1e-9) throw new Error('Not enough balance. Add funds first.');
    if (!entry) throw new Error('Price is not available yet.');
    if (side === 'long') {
      if (sl && sl >= entry) throw new Error('For a long, stop loss must be below the entry price.');
      if (tp && tp <= entry) throw new Error('For a long, take profit must be above the entry price.');
    } else {
      if (sl && sl <= entry) throw new Error('For a short, stop loss must be above the entry price.');
      if (tp && tp >= entry) throw new Error('For a short, take profit must be below the entry price.');
    }
  };

  const actions = {
    deposit(amount) {
      if (!(amount > 0)) throw new Error('Enter an amount above 0.');
      setAcct((a) => ({ ...a, cash: a.cash + amount, txs: [{ id: uid(), type: 'Deposit', amount, at: Date.now() }, ...a.txs] }));
    },
    withdraw(amount) {
      if (!(amount > 0)) throw new Error('Enter an amount above 0.');
      if (amount > ref.current.cash) throw new Error('You can only withdraw free balance.');
      setAcct((a) => ({ ...a, cash: a.cash - amount, txs: [{ id: uid(), type: 'Withdraw', amount: -amount, at: Date.now() }, ...a.txs] }));
    },
    openMarket({ symbol, side, margin, leverage, sl, tp }) {
      const entry = pricesRef.current[symbol];
      validate({ side, margin, entry, sl, tp });
      const pos = { id: uid(), symbol, side, entry, qty: (margin * leverage) / entry, margin, leverage, sl: sl || null, tp: tp || null, openedAt: Date.now() };
      setAcct((a) => ({ ...a, cash: a.cash - margin, positions: [pos, ...a.positions] }));
    },
    placeLimit({ symbol, side, price, margin, leverage, sl, tp }) {
      const px = pricesRef.current[symbol];
      validate({ side, margin, entry: price, sl, tp });
      if (side === 'long' && price >= px) throw new Error('Limit buy must be below the current price.');
      if (side === 'short' && price <= px) throw new Error('Limit sell must be above the current price.');
      const order = { id: uid(), symbol, side, price, margin, leverage, sl: sl || null, tp: tp || null, createdAt: Date.now() };
      setAcct((a) => ({ ...a, cash: a.cash - margin, orders: [order, ...a.orders] }));
    },
    cancelOrder(id) {
      setAcct((a) => {
        const o = a.orders.find((x) => x.id === id);
        if (!o) return a;
        return { ...a, cash: a.cash + o.margin, orders: a.orders.filter((x) => x.id !== id) };
      });
    },
    closePosition(id) {
      setAcct((a) => {
        const p = a.positions.find((x) => x.id === id);
        const px = pricesRef.current[p?.symbol];
        if (!p || !px) return a;
        const pnl = Math.max(pnlOf(p, px), -p.margin);
        const rec = { ...p, exit: px, pnl, reason: 'Manual', closedAt: Date.now() };
        seenHistory.current = rec.id; // manual close: no toast
        return { ...a, cash: a.cash + p.margin + pnl, positions: a.positions.filter((x) => x.id !== id), history: [rec, ...a.history].slice(0, 300) };
      });
    },
    closeAll() { ref.current.positions.forEach((p) => actions.closePosition(p.id)); },
    modifyPosition(id, { sl, tp }) {
      const p = ref.current.positions.find((x) => x.id === id);
      if (!p) return;
      const px = pricesRef.current[p.symbol];
      if (p.side === 'long') {
        if (sl && sl >= px) throw new Error('Stop loss must be below the current price.');
        if (tp && tp <= px) throw new Error('Take profit must be above the current price.');
      } else {
        if (sl && sl <= px) throw new Error('Stop loss must be above the current price.');
        if (tp && tp >= px) throw new Error('Take profit must be below the current price.');
      }
      setAcct((a) => ({ ...a, positions: a.positions.map((x) => (x.id === id ? { ...x, sl: sl || null, tp: tp || null } : x)) }));
    },
    resetAccount() { setAcct(emptyAccount()); },
  };

  // Account summary, recalculated on every live price tick
  const summary = useMemo(() => {
    let unrealized = 0, usedMargin = 0;
    for (const p of acct.positions) {
      usedMargin += p.margin;
      const px = prices[p.symbol];
      if (px) unrealized += pnlOf(p, px);
    }
    const reserved = acct.orders.reduce((s, o) => s + o.margin, 0);
    return { unrealized, usedMargin, reserved, equity: acct.cash + usedMargin + reserved + unrealized };
  }, [acct, prices]);

  return <Ctx.Provider value={{ acct, summary, toasts, dismissToast, ...actions }}>{children}</Ctx.Provider>;
}
