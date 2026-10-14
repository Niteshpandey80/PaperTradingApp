import { useState } from 'react';
import { usePrices } from '../../context/PriceContext.jsx';
import { useTrading, pnlOf } from '../../context/TradingContext.jsx';
import { baseOf } from '../../services/market.js';
import { fmtDate, fmtPrice, fmtQty, fmtUsd, pnlClass } from '../../utils/format.js';

function PositionRow({ p, price }) {
  const { closePosition, modifyPosition } = useTrading();
  const [sl, setSl] = useState(p.sl || '');
  const [tp, setTp] = useState(p.tp || '');
  const [err, setErr] = useState('');
  const dirty = (+sl || 0) !== (p.sl || 0) || (+tp || 0) !== (p.tp || 0);
  const pnl = price ? pnlOf(p, price) : 0;

  const save = () => {
    try { modifyPosition(p.id, { sl: +sl || null, tp: +tp || null }); setErr(''); }
    catch (e) { setErr(e.message); }
  };

  return (
    <tr>
      <td><b>{baseOf(p.symbol)}</b></td>
      <td className={p.side === 'long' ? 'up' : 'down'}>{p.side === 'long' ? 'Long' : 'Short'} {p.leverage}x</td>
      <td>{fmtQty(p.qty)}</td>
      <td>{fmtPrice(p.entry, p.symbol)}</td>
      <td>{fmtPrice(price, p.symbol)}</td>
      <td className={pnlClass(pnl)}>{fmtUsd(pnl)} <small>({((pnl / p.margin) * 100).toFixed(2)}%)</small></td>
      <td>{fmtUsd(p.margin)}</td>
      <td><input className="mini" type="number" step="any" placeholder="SL" value={sl} onChange={(e) => setSl(e.target.value)} /></td>
      <td><input className="mini" type="number" step="any" placeholder="TP" value={tp} onChange={(e) => setTp(e.target.value)} /></td>
      <td className="actions">
        {dirty && <button className="btn small" onClick={save}>Save</button>}
        <button className="btn small danger" onClick={() => closePosition(p.id)}>Close</button>
        {err && <div className="row-err">{err}</div>}
      </td>
    </tr>
  );
}

export default function PositionsPanel() {
  const { prices } = usePrices();
  const { acct, cancelOrder, closeAll } = useTrading();
  const [tab, setTab] = useState('positions');

  const tabs = [
    ['positions', `Positions (${acct.positions.length})`],
    ['orders', `Orders (${acct.orders.length})`],
    ['history', 'History'],
    ['funds', 'Funds'],
  ];

  return (
    <div className="panel bottom">
      <div className="tabs">
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        {tab === 'positions' && acct.positions.length > 1 && <button className="close-all" onClick={closeAll}>Close all</button>}
      </div>
      <div className="table-wrap">
        {tab === 'positions' && (acct.positions.length === 0 ? <div className="empty">No open positions. Place a trade from the panel on the right.</div> : (
          <table>
            <thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>P&amp;L</th><th>Margin</th><th>SL</th><th>TP</th><th></th></tr></thead>
            <tbody>{acct.positions.map((p) => <PositionRow key={p.id} p={p} price={prices[p.symbol]} />)}</tbody>
          </table>
        ))}

        {tab === 'orders' && (acct.orders.length === 0 ? <div className="empty">No pending limit orders.</div> : (
          <table>
            <thead><tr><th>Symbol</th><th>Side</th><th>Limit price</th><th>Margin</th><th>Leverage</th><th>SL</th><th>TP</th><th></th></tr></thead>
            <tbody>{acct.orders.map((o) => (
              <tr key={o.id}>
                <td><b>{baseOf(o.symbol)}</b></td>
                <td className={o.side === 'long' ? 'up' : 'down'}>{o.side === 'long' ? 'Buy' : 'Sell'}</td>
                <td>{fmtPrice(o.price, o.symbol)}</td><td>{fmtUsd(o.margin)}</td><td>{o.leverage}x</td>
                <td>{o.sl ? fmtPrice(o.sl, o.symbol) : '—'}</td><td>{o.tp ? fmtPrice(o.tp, o.symbol) : '—'}</td>
                <td><button className="btn small danger" onClick={() => cancelOrder(o.id)}>Cancel</button></td>
              </tr>
            ))}</tbody>
          </table>
        ))}

        {tab === 'history' && (acct.history.length === 0 ? <div className="empty">Closed trades will appear here.</div> : (
          <table>
            <thead><tr><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Closed by</th><th>Time</th></tr></thead>
            <tbody>{acct.history.map((h) => (
              <tr key={h.id}>
                <td><b>{baseOf(h.symbol)}</b></td>
                <td className={h.side === 'long' ? 'up' : 'down'}>{h.side === 'long' ? 'Long' : 'Short'} {h.leverage}x</td>
                <td>{fmtPrice(h.entry, h.symbol)}</td><td>{fmtPrice(h.exit, h.symbol)}</td>
                <td className={pnlClass(h.pnl)}>{fmtUsd(h.pnl)}</td><td>{h.reason}</td><td>{fmtDate(h.closedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        ))}

        {tab === 'funds' && (acct.txs.length === 0 ? <div className="empty">No deposits yet. Use “Add funds” at the top.</div> : (
          <table>
            <thead><tr><th>Type</th><th>Amount</th><th>Time</th></tr></thead>
            <tbody>{acct.txs.map((t) => (
              <tr key={t.id}><td>{t.type}</td><td className={pnlClass(t.amount)}>{fmtUsd(t.amount)}</td><td>{fmtDate(t.at)}</td></tr>
            ))}</tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
