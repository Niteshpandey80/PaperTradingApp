# Paper Terminal: TradingView-style paper trading (React + Vite)

## Run it
```bash
npm install
npm run dev
```
Open http://localhost:5173, create an account (balance starts at **$0**), click **Add funds**, then trade.

## Matching TradingView prices exactly
Prices differ between exchanges and between USD and USDT pairs. Pick the same source in both places:

| This app                | TradingView symbol  |
|-------------------------|---------------------|
| Binance BTC/USDT        | `BINANCE:BTCUSDT`   |
| Coinbase BTC/USD        | `COINBASE:BTCUSD`   |

TradingView's default "BTCUSD" is a USD pair, so compare it with the **Coinbase (USD)** symbols here. The chart legend and header show which exchange you are viewing.

## Why the numbers can still differ from TradingView
- **Pick the same exchange + pair.** Binance BTC/USDT is *not* the same market as BTC/USD. Even on the same exchange, USDT vs USD trades a small premium.
- **Day change** is measured from the previous daily close (UTC), exactly like TradingView.
- **Times** on the chart and the clock use your computer's timezone, like TradingView.

## Features
- Tick-by-tick live candles, local-timezone time axis, candle countdown (Binance + Coinbase), with automatic reconnect and REST fallback
- Exchange-exact price precision (XRP, DOGE and other small coins show every decimal)
- Candles / Bars / Line / Area, Volume, SMA 20, EMA 50, Bollinger Bands
- Drawing tools: horizontal line, trend line, clear
- Login / register, balance, equity, open P&L, add / withdraw paper funds
- Market and Limit orders, long/short, leverage 1x to 50x, Stop Loss and Take Profit (editable later)
- Auto close on SL / TP / liquidation with alerts
- Positions, Orders, History and Funds tabs

## Folder structure
```
src/
  context/   AuthContext, PriceContext, TradingContext
  services/  binance.js, coinbase.js, market.js (unified), storage.js
  utils/     format.js, indicators.js
  components/Chart/  ChartPanel, ChartToolbar, DrawingTools
  components/Trade/  Watchlist, OrderPanel, PositionsPanel, FundsModal
  components/Layout/ Header, Toasts
  pages/     Login.jsx, Terminal.jsx
```

## Notes
- If Binance is blocked in your region use the Coinbase symbols, or add a `.env` with
  `VITE_REST=https://data-api.binance.vision` and `VITE_WS=wss://data-stream.binance.vision`.
- Coinbase timeframes: 1m, 5m, 15m, 1h, 6h, 1d (Coinbase has no 1s, 4h or 1w).
- USDT is treated as 1 USD for balances. Login is demo-only (localStorage). Paper trading only.
