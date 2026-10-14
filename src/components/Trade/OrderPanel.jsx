import { useState } from 'react';
import { usePrices } from '../../context/PriceContext.jsx';
import { useTrading, liqPrice } from '../../context/TradingContext.jsx';
import { baseOf } from '../../services/market.js';
import { fmtPrice, fmtQty, fmtUsd } from '../../utils/format.js';

export default function OrderPanel({ symbol, onFunds }) {
  const { prices } = usePrices();
  const { acct, openMarket, placeLimit } = useTrading();
  const [side, setSide] = useState('long');
  const [type, setType] = useState('market');
  const [limit, setLimit] = useState('');
  const [amount, setAmount] = useState('');
  const [lev, setLev] = useState(5);
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [msg, setMsg] = useState(null);

  const px = prices[symbol];
  const entry = type === 'market' ? px : +limit;
  const margin = +amount || 0;
  const notional = margin * lev;
  const qty = entry ? notional / entry : 0;
  const liq = entry && margin ? liqPrice(side, entry, lev) : null;
  const base = baseOf(symbol);

  const submit = () => {
    try {
      const o = { symbol, side, margin, leverage: lev, sl: +sl || null, tp: +tp || null };
      if (type === 'market') openMarket(o); else placeLimit({ ...o, price: +limit });
      setMsg({ ok: true, text: type === 'market' ? 'Position opened.' : 'Limit order placed.' });
      setAmount(''); setSl(''); setTp('');
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  const setPct = (p) => setAmount(((acct.cash * p) / 100).toFixed(2));

  return (
    <div className="panel order-panel">
      <div className="panel-title">Trade {base}</div>
      <div className="side-switch">
        <button className={side === 'long' ? 'buy on' : 'buy'} onClick={() => setSide('long')}>Buy / Long</button>
        <button className={side === 'short' ? 'sell on' : 'sell'} onClick={() => setSide('short')}>Sell / Short</button>
      </div>
      <div className="seg full">
        <button className={type === 'market' ? 'on' : ''} onClick={() => setType('market')}>Market</button>
        <button className={type === 'limit' ? 'on' : ''} onClick={() => { setType('limit'); if (!limit && px) setLimit(String(px)); }}>Limit</button>
      </div>

      {type === 'limit' && (
        <label className="field"><span>Limit price</span>
          <input type="number" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
      )}
      <label className="field"><span>Amount (USD margin)</span>
        <input type="number" step="any" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <div className="pct">
        {[25, 50, 75, 100].map((p) => <button key={p} onClick={() => setPct(p)}>{p}%</button>)}
      </div>
      <label className="field"><span>Leverage <b>{lev}x</b></span>
        <input type="range" min="1" max="50" value={lev} onChange={(e) => setLev(+e.target.value)} />
      </label>
      <div className="two">
        <label className="field"><span>Stop loss</span>
          <input type="number" step="any" placeholder="Price" value={sl} onChange={(e) => setSl(e.target.value)} />
        </label>
        <label className="field"><span>Take profit</span>
          <input type="number" step="any" placeholder="Price" value={tp} onChange={(e) => setTp(e.target.value)} />
        </label>
      </div>

      <div className="calc">
        <div><span>Entry</span><b>{fmtPrice(entry, symbol)}</b></div>
        <div><span>Position size</span><b>{fmtUsd(notional)}</b></div>
        <div><span>Quantity</span><b>{qty ? `${fmtQty(qty)} ${base}` : '—'}</b></div>
        <div><span>Liquidation</span><b>{liq ? fmtPrice(liq, symbol) : '—'}</b></div>
      </div>

      {acct.cash <= 0 ? (
        <button className="btn primary wide" onClick={onFunds}>Add funds to start trading</button>
      ) : (
        <button className={`btn wide ${side === 'long' ? 'buy-btn' : 'sell-btn'}`} onClick={submit}>
          {type === 'market' ? (side === 'long' ? 'Buy / Long' : 'Sell / Short') : 'Place limit order'} {base}
        </button>
      )}
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
    </div>
  );
}
