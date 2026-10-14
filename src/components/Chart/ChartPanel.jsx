import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { exchangeName, labelOf, loadHistory, openChartStream, periodOf } from '../../services/market.js';
import { sma, ema, bollinger } from '../../utils/indicators.js';
import { useTrading } from '../../context/TradingContext.jsx';
import { fmtPrice, fmtQty, getPrecision } from '../../utils/format.js';

const UP = '#26a69a';
const DOWN = '#ef5350';
const IND = {
  sma: { color: '#f7a600', calc: (d) => [sma(d, 20)] },
  ema: { color: '#e040fb', calc: (d) => [ema(d, 50)] },
  bb: { color: '#00bcd4', calc: (d) => bollinger(d, 20, 2) },
};

export default function ChartPanel({ symbol, interval, chartType, indicators, tool, setTool, clearSignal }) {
  const el = useRef(null);
  const chartRef = useRef(null);
  const mainRef = useRef(null);
  const volRef = useRef(null);
  const dataRef = useRef([]);
  const indSeries = useRef({});
  const linesRef = useRef([]);
  const drawRef = useRef([]);
  const pending = useRef(null);
  const toolRef = useRef(tool); toolRef.current = tool;
  const typeRef = useRef(chartType); typeRef.current = chartType;
  const indRef = useRef(indicators); indRef.current = indicators;
  const setToolRef = useRef(setTool); setToolRef.current = setTool;

  const [ready, setReady] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [last, setLast] = useState(null);
  const [conn, setConn] = useState('connecting');
  const [, setPrec] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const precRef = useRef(getPrecision(symbol));
  const [hover, setHover] = useState(null);
  const { acct } = useTrading();

  const isLine = () => typeRef.current === 'line' || typeRef.current === 'area';
  const toPoint = (c) => (isLine() ? { time: c.time, value: c.close } : c);
  const volPoint = (c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(38,166,154,.4)' : 'rgba(239,83,80,.4)' });

  const applyPrecision = (series, prec) => {
    if (series) series.applyOptions({ priceFormat: { type: 'price', precision: prec, minMove: 1 / Math.pow(10, prec) } });
  };

  function updateIndicators() {
    const chart = chartRef.current;
    if (!chart) return;
    for (const key of Object.keys(IND)) {
      const cur = indSeries.current[key];
      if (!indRef.current[key]) {
        if (cur) { cur.forEach((s) => chart.removeSeries(s)); delete indSeries.current[key]; }
        continue;
      }
      const lines = IND[key].calc(dataRef.current);
      if (!cur) {
        indSeries.current[key] = lines.map(() => chart.addLineSeries({
          color: IND[key].color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        }));
      }
      indSeries.current[key].forEach((s, i) => s.setData(lines[i]));
    }
  }

  function clearDrawings() {
    const chart = chartRef.current;
    drawRef.current.forEach((d) => {
      try { d.type === 'line' ? mainRef.current.removePriceLine(d.obj) : chart.removeSeries(d.obj); } catch { /* already removed */ }
    });
    drawRef.current = [];
    pending.current = null;
  }

  // 1) Create the chart once
  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      localization: {
        timeFormatter: (t) => new Date(t * 1000).toLocaleString('en-GB', {
          weekday: 'short', day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }),
      },
      layout: { background: { color: '#131722' }, textColor: '#d1d4dc', fontFamily: 'Inter, system-ui, sans-serif' },
      grid: { vertLines: { color: '#1c202b' }, horzLines: { color: '#1c202b' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2e39' },
      timeScale: {
        borderColor: '#2a2e39', timeVisible: true, secondsVisible: true, rightOffset: 8,
        // show times in YOUR timezone (the library defaults to UTC)
        tickMarkFormatter: (time, type) => {
          const d = new Date(time * 1000);
          if (type === 0) return String(d.getFullYear());
          if (type === 1) return d.toLocaleDateString('en-GB', { month: 'short' });
          if (type === 2) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: type === 4 ? '2-digit' : undefined, hour12: false });
        },
      },
    });
    chartRef.current = chart;
    volRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData && mainRef.current ? p.seriesData.get(mainRef.current) : null;
      setHover(d && d.open !== undefined ? d : null);
    });

    chart.subscribeClick((param) => {
      const t = toolRef.current;
      if (t === 'cursor' || !param.point || !mainRef.current) return;
      const price = mainRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;
      if (t === 'hline') {
        const l = mainRef.current.createPriceLine({ price, color: '#f7a600', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Line' });
        drawRef.current.push({ type: 'line', obj: l });
        setToolRef.current('cursor');
      } else if (t === 'trend') {
        if (!param.time) return;
        if (!pending.current) { pending.current = { time: param.time, price }; return; }
        const pts = [pending.current, { time: param.time, price }].sort((a, b) => a.time - b.time);
        pending.current = null;
        if (pts[0].time === pts[1].time) return;
        const s = chart.addLineSeries({ color: '#2962ff', lineWidth: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        s.setData(pts.map((p) => ({ time: p.time, value: p.price })));
        drawRef.current.push({ type: 'series', obj: s });
        setToolRef.current('cursor');
      }
    });

    return () => { chart.remove(); chartRef.current = null; mainRef.current = null; indSeries.current = {}; };
  }, []);

  // 2) (Re)build main series when chart type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (mainRef.current) { try { chart.removeSeries(mainRef.current); } catch { /* noop */ } }
    let s;
    if (chartType === 'candles') s = chart.addCandlestickSeries({ upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN });
    else if (chartType === 'bars') s = chart.addBarSeries({ upColor: UP, downColor: DOWN });
    else if (chartType === 'line') s = chart.addLineSeries({ color: '#2962ff', lineWidth: 2 });
    else s = chart.addAreaSeries({ lineColor: '#2962ff', topColor: 'rgba(41,98,255,.4)', bottomColor: 'rgba(41,98,255,0)' });
    mainRef.current = s;
    applyPrecision(s, precRef.current);
    s.setData(dataRef.current.map(toPoint));
    setReady((n) => n + 1);
  }, [chartType]);

  // 3) Load history, then stream live: every trade tick moves the current candle
  useEffect(() => {
    let cancelled = false;
    let stop = () => {};
    let timer = null;
    let lastTickMs = 0;
    const period = periodOf(symbol, interval);
    precRef.current = getPrecision(symbol);
    applyPrecision(mainRef.current, precRef.current);
    setLoading(true); setError(''); setConn('connecting');
    clearDrawings();

    const flush = () => {
      timer = null;
      const d = dataRef.current;
      const c = d[d.length - 1];
      if (!c || !mainRef.current) return;
      mainRef.current.update(toPoint(c));
      volRef.current.update(volPoint(c));
      updateIndicators();
      setLast({ ...c });
    };
    const markDirty = () => { if (!timer) timer = setTimeout(flush, 60); };

    // authoritative candle from the exchange
    const applyKline = (k, eventMs) => {
      const d = dataRef.current;
      const tail = d[d.length - 1];
      if (tail && k.time < tail.time) return;
      if (tail && k.time === tail.time) {
        const c = { ...k };
        if (lastTickMs > eventMs) { c.close = tail.close; c.high = Math.max(k.high, tail.high); c.low = Math.min(k.low, tail.low); }
        d[d.length - 1] = c;
      } else d.push(k);
      markDirty();
    };

    // single trade tick: moves close/high/low, or opens a new candle
    const applyTick = (price, ms, size = 0) => {
      const d = dataRef.current;
      const tail = d[d.length - 1];
      if (!tail) return;
      const t = ms / 1000;
      if (t < tail.time) return;
      lastTickMs = ms;
      if (t >= tail.time + period) {
        const start = tail.time + Math.floor((t - tail.time) / period) * period;
        d.push({ time: start, open: price, high: price, low: price, close: price, volume: size });
      } else {
        tail.close = price;
        tail.volume += size;
        if (price > tail.high) tail.high = price;
        if (price < tail.low) tail.low = price;
      }
      markDirty();
    };

    loadHistory(symbol, interval).then(({ candles: data, precision }) => {
      if (cancelled) return;
      precRef.current = precision;
      applyPrecision(mainRef.current, precision);
      setPrec(precision);
      dataRef.current = data;
      mainRef.current.setData(data.map(toPoint));
      volRef.current.setData(data.map(volPoint));
      updateIndicators();
      chartRef.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 140), to: data.length + 8 });
      setLast(data[data.length - 1]);
      setLoading(false);

      stop = openChartStream(symbol, interval, {
        onStatus: (st) => { if (!cancelled) setConn(st); },
        onCandle: applyKline,
        onTick: applyTick,
      });
    }).catch((e) => { if (!cancelled) { setError(e.message || 'Could not load market data.'); setLoading(false); } });

    return () => { cancelled = true; clearTimeout(timer); stop(); };
  }, [symbol, interval]);

  // 4) Indicator toggles + volume visibility
  useEffect(() => {
    updateIndicators();
    volRef.current && volRef.current.applyOptions({ visible: !!indicators.volume });
  }, [indicators]);

  // 5) Clear drawings button
  useEffect(() => { if (clearSignal) clearDrawings(); }, [clearSignal]);

  // 6) Entry / SL / TP / pending-order lines for the open symbol
  useEffect(() => {
    const s = mainRef.current;
    if (!s) return;
    linesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch { /* old series */ } });
    linesRef.current = [];
    const add = (price, color, title, lineStyle = LineStyle.Solid) => {
      if (!price) return;
      linesRef.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle, axisLabelVisible: true, title }));
    };
    acct.positions.filter((p) => p.symbol === symbol).forEach((p) => {
      add(p.entry, p.side === 'long' ? UP : DOWN, `${p.side === 'long' ? 'LONG' : 'SHORT'} ${fmtQty(p.qty)}`);
      add(p.sl, DOWN, 'SL', LineStyle.Dashed);
      add(p.tp, UP, 'TP', LineStyle.Dashed);
    });
    acct.orders.filter((o) => o.symbol === symbol).forEach((o) => {
      add(o.price, '#f7a600', `LIMIT ${o.side === 'long' ? 'BUY' : 'SELL'}`, LineStyle.Dotted);
      add(o.sl, DOWN, 'SL', LineStyle.Dashed);
      add(o.tp, UP, 'TP', LineStyle.Dashed);
    });
  }, [acct.positions, acct.orders, symbol, ready]);

  const tailCandle = dataRef.current[dataRef.current.length - 1];
  const left = tailCandle ? Math.max(0, tailCandle.time + periodOf(symbol, interval) - Math.floor(now / 1000)) : null;
  const fmtLeft = (n) => {
    if (n == null) return '';
    if (n >= 86400) return `${Math.floor(n / 86400)}d ${Math.floor((n % 86400) / 3600)}h`;
    const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), sec = n % 60;
    const two = (x) => String(x).padStart(2, '0');
    return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
  };
  const c = hover || last;
  const up = c ? c.close >= c.open : true;

  return (
    <div className={`chart-box tool-${tool}`}>
      <div ref={el} className="chart-canvas" />
      <div className="chart-legend">
        <b>{labelOf(symbol)}</b> <span className="muted">{exchangeName(symbol)} · {interval}</span>
        {left != null && <span className="countdown" title="Time until this candle closes"> ⏱ {fmtLeft(left)}</span>}
        {c && c.open !== undefined && (
          <span className={up ? 'up' : 'down'}>
            {' '}O {fmtPrice(c.open, symbol)} H {fmtPrice(c.high, symbol)} L {fmtPrice(c.low, symbol)} C {fmtPrice(c.close, symbol)}
          </span>
        )}
      </div>
      {tool !== 'cursor' && (
        <div className="chart-hint">
          {tool === 'hline' ? 'Click the chart to place a horizontal line' : 'Click two points to draw a trend line'}
        </div>
      )}
      <div className={`conn-badge ${conn}`}>
        <i /> {conn === 'live' ? 'Live' : conn === 'polling' ? 'Live (fallback)' : 'Connecting'}
      </div>
      <button className="to-live" title="Jump to latest candle" onClick={() => chartRef.current && chartRef.current.timeScale().scrollToRealTime()}>Latest ▸▸</button>
      {loading && <div className="chart-overlay">Loading live data…</div>}
      {error && <div className="chart-overlay err">{error}</div>}
    </div>
  );
}
