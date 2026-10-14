import { useState } from 'react';
import Header from '../components/Layout/Header.jsx';
import Toasts from '../components/Layout/Toasts.jsx';
import Clock from '../components/Layout/Clock.jsx';
import ChartPanel from '../components/Chart/ChartPanel.jsx';
import ChartToolbar from '../components/Chart/ChartToolbar.jsx';
import DrawingTools from '../components/Chart/DrawingTools.jsx';
import Watchlist from '../components/Trade/Watchlist.jsx';
import OrderPanel from '../components/Trade/OrderPanel.jsx';
import PositionsPanel from '../components/Trade/PositionsPanel.jsx';
import FundsModal from '../components/Trade/FundsModal.jsx';
import { usePrices } from '../context/PriceContext.jsx';
import { fmtPrice } from '../utils/format.js';
import { exchangeName, intervalsFor, labelOf } from '../services/market.js';

export default function Terminal() {
  const [symbol, setSymbol] = useState('BTC-USD');
  const [interval, setInterval] = useState('1m');
  const [chartType, setChartType] = useState('candles');
  const [indicators, setIndicators] = useState({ volume: true, sma: false, ema: false, bb: false });
  const [tool, setTool] = useState('cursor');
  const [clearSignal, setClearSignal] = useState(0);
  const [funds, setFunds] = useState(false);
  const { prices, changeOf, changeAbs, dayRange } = usePrices();
  const ch = changeOf(symbol);
  const chAbs = changeAbs(symbol);
  const range = dayRange(symbol);
  const safeInterval = intervalsFor(symbol).includes(interval) ? interval : '1m';

  return (
    <div className="app">
      <Header onFunds={() => setFunds(true)} />
      <div className="main">
        <DrawingTools tool={tool} setTool={setTool} onClear={() => setClearSignal((n) => n + 1)} />
        <div className="center">
          <ChartToolbar {...{ symbol, setSymbol, interval: safeInterval, setInterval, chartType, setChartType, indicators, setIndicators }} />
          <div className="quote">
            <span className="q-price">{fmtPrice(prices[symbol], symbol)}</span>
            <span className={ch >= 0 ? 'up' : 'down'}>
              {chAbs >= 0 ? '+' : '-'}{fmtPrice(Math.abs(chAbs), symbol)} {ch >= 0 ? '+' : ''}{ch.toFixed(2)}%
            </span>
            <span className="muted">{labelOf(symbol)} · {exchangeName(symbol)}</span>
            <span className="muted" title="Today's range (UTC day), same as TradingView">H {fmtPrice(range.high, symbol)}  L {fmtPrice(range.low, symbol)}</span>
            <span className="spacer" />
            <Clock />
          </div>
          <ChartPanel {...{ symbol, interval: safeInterval, chartType, indicators, tool, setTool, clearSignal }} />
          <PositionsPanel />
        </div>
        <aside className="right">
          <Watchlist symbol={symbol} setSymbol={setSymbol} />
          <OrderPanel symbol={symbol} onFunds={() => setFunds(true)} />
        </aside>
      </div>
      {funds && <FundsModal onClose={() => setFunds(false)} />}
      <Toasts />
    </div>
  );
}
