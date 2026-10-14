import { INSTRUMENTS, intervalsFor } from '../../services/market.js';

const TYPES = [['candles', 'Candles'], ['bars', 'Bars'], ['line', 'Line'], ['area', 'Area']];
const INDS = [['volume', 'Volume'], ['sma', 'SMA 20'], ['ema', 'EMA 50'], ['bb', 'Bollinger']];

export default function ChartToolbar({ symbol, setSymbol, interval, setInterval, chartType, setChartType, indicators, setIndicators }) {
  return (
    <div className="chart-toolbar">
      <select className="sym-select" value={symbol} onChange={(e) => setSymbol(e.target.value)} title="Symbol and price source">
        <optgroup label="Binance (USDT pairs)">
          {INSTRUMENTS.filter((i) => i.ex === 'binance').map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </optgroup>
        <optgroup label="Coinbase (USD pairs)">
          {INSTRUMENTS.filter((i) => i.ex === 'coinbase').map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </optgroup>
      </select>
      <div className="seg">
        {intervalsFor(symbol).map((i) => (
          <button key={i} className={interval === i ? 'on' : ''} onClick={() => setInterval(i)}>{i}</button>
        ))}
      </div>
      <div className="seg">
        {TYPES.map(([v, l]) => (
          <button key={v} className={chartType === v ? 'on' : ''} onClick={() => setChartType(v)}>{l}</button>
        ))}
      </div>
      <div className="seg">
        {INDS.map(([k, l]) => (
          <button key={k} className={indicators[k] ? 'on' : ''} onClick={() => setIndicators({ ...indicators, [k]: !indicators[k] })}>{l}</button>
        ))}
      </div>
    </div>
  );
}
