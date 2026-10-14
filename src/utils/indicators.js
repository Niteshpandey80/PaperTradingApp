export function sma(d, p) {
  const out = []; let sum = 0;
  for (let i = 0; i < d.length; i++) {
    sum += d[i].close;
    if (i >= p) sum -= d[i - p].close;
    if (i >= p - 1) out.push({ time: d[i].time, value: sum / p });
  }
  return out;
}

export function ema(d, p) {
  const k = 2 / (p + 1); const out = []; let sum = 0; let e;
  for (let i = 0; i < d.length; i++) {
    const c = d[i].close;
    if (i < p - 1) { sum += c; continue; }
    if (i === p - 1) { sum += c; e = sum / p; } else e = c * k + e * (1 - k);
    out.push({ time: d[i].time, value: e });
  }
  return out;
}

// Returns [upper, middle, lower]
export function bollinger(d, p = 20, mult = 2) {
  const up = [], mid = [], low = [];
  for (let i = p - 1; i < d.length; i++) {
    let m = 0;
    for (let j = i - p + 1; j <= i; j++) m += d[j].close;
    m /= p;
    let v = 0;
    for (let j = i - p + 1; j <= i; j++) v += (d[j].close - m) ** 2;
    const sd = Math.sqrt(v / p);
    up.push({ time: d[i].time, value: m + mult * sd });
    mid.push({ time: d[i].time, value: m });
    low.push({ time: d[i].time, value: m - mult * sd });
  }
  return [up, mid, low];
}
