import { INSTRUMENTS } from '../../services/market.js';
import { usePrices } from '../../context/PriceContext.jsx';
import { fmtPrice } from '../../utils/format.js';

const GROUPS = [['binance', 'Binance (USDT)'], ['coinbase', 'Coinbase (USD)']];

export default function Watchlist({ symbol, setSymbol }) {
  const { prices, changeOf } = usePrices();
  return (
    <div className="panel watchlist">
      <div className="panel-title">Watchlist</div>
      <div className="wl-head"><span>Symbol</span><span>Last</span><span>24h</span></div>
      <div className="wl-body">
        {GROUPS.map(([ex, title]) => (
          <div key={ex}>
            <div className="wl-group">{title}</div>
            {INSTRUMENTS.filter((i) => i.ex === ex).map((i) => {
              const ch = changeOf(i.id);
              return (
                <button key={i.id} className={`wl-row ${symbol === i.id ? 'on' : ''}`} onClick={() => setSymbol(i.id)}>
                  <span>{i.base}</span>
                  <span>{fmtPrice(prices[i.id], i.id)}</span>
                  <span className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
