import { useEffect, useState } from 'react';

const fmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short',
});

// Live clock in your own timezone (the chart's time axis uses the same timezone)
export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span className="clock" title="Your local time. Chart times use this timezone.">{fmt.format(now)}</span>;
}
