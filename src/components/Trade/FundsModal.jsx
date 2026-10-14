import { useState } from 'react';
import { useTrading } from '../../context/TradingContext.jsx';
import { fmtUsd } from '../../utils/format.js';

export default function FundsModal({ onClose }) {
  const { acct, deposit, withdraw, resetAccount } = useTrading();
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState(null);

  const run = (fn, label) => {
    try { fn(+amount); setMsg({ ok: true, text: `${label} ${fmtUsd(+amount)} done.` }); setAmount(''); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>Paper funds</h3><button className="x" onClick={onClose}>×</button></div>
        <p className="muted">Practice money only. Add any amount you like.</p>
        <div className="big-balance"><span>Available balance</span><b>{fmtUsd(acct.cash)}</b></div>
        <label className="field"><span>Amount (USD)</span>
          <input autoFocus type="number" step="any" placeholder="e.g. 10000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="pct">
          {[1000, 10000, 100000, 1000000].map((v) => <button key={v} onClick={() => setAmount(String(v))}>${v.toLocaleString()}</button>)}
        </div>
        <div className="two">
          <button className="btn primary" onClick={() => run(deposit, 'Added')}>Add funds</button>
          <button className="btn ghost" onClick={() => run(withdraw, 'Withdrew')}>Withdraw</button>
        </div>
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'bad'}`}>{msg.text}</div>}
        <button className="link-danger" onClick={() => { if (confirm('Reset your account to $0 and clear all trades?')) { resetAccount(); onClose(); } }}>Reset account</button>
      </div>
    </div>
  );
}
