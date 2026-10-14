import { useAuth } from '../../context/AuthContext.jsx';
import { usePrices } from '../../context/PriceContext.jsx';
import { useTrading } from '../../context/TradingContext.jsx';
import { fmtUsd, pnlClass } from '../../utils/format.js';

export default function Header({ onFunds }) {
  const { user, logout } = useAuth();
  const { status } = usePrices();
  const { acct, summary } = useTrading();

  return (
    <header className="header">
      <div className="brand">
        <span className="logo">◢</span> Paper Terminal
        <span className={`status ${status === 'connecting' ? '' : 'live'}`} title={status}>{status === 'live' ? 'Live' : status === 'polling' ? 'Live (fallback)' : 'Connecting'}</span>
      </div>
      <div className="stats">
        <div className="stat"><span>Balance</span><b>{fmtUsd(acct.cash)}</b></div>
        <div className="stat"><span>Equity</span><b>{fmtUsd(summary.equity)}</b></div>
        <div className="stat"><span>Open P&amp;L</span><b className={pnlClass(summary.unrealized)}>{fmtUsd(summary.unrealized)}</b></div>
        <div className="stat"><span>Margin used</span><b>{fmtUsd(summary.usedMargin + summary.reserved)}</b></div>
      </div>
      <div className="header-actions">
        <button className="btn primary" onClick={onFunds}>+ Add funds</button>
        <span className="user">{user}</span>
        <button className="btn ghost" onClick={logout}>Log out</button>
      </div>
    </header>
  );
}
