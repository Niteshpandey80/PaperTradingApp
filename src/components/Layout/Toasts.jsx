import { useEffect } from 'react';
import { useTrading } from '../../context/TradingContext.jsx';

function Toast({ t, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 7000); return () => clearTimeout(id); }, []);
  return <div className={`toast ${t.type}`} onClick={onDone}>{t.text}</div>;
}

export default function Toasts() {
  const { toasts, dismissToast } = useTrading();
  return (
    <div className="toasts">
      {toasts.map((t) => <Toast key={t.id} t={t} onDone={() => dismissToast(t.id)} />)}
    </div>
  );
}
