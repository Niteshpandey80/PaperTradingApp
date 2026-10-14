const TOOLS = [
  ['cursor', '✛', 'Cursor'],
  ['hline', '—', 'Horizontal line'],
  ['trend', '╱', 'Trend line'],
];

export default function DrawingTools({ tool, setTool, onClear }) {
  return (
    <div className="drawing-tools">
      {TOOLS.map(([k, icon, label]) => (
        <button key={k} title={label} className={tool === k ? 'on' : ''} onClick={() => setTool(k)}>{icon}</button>
      ))}
      <button title="Remove drawings" onClick={onClear}>⌫</button>
    </div>
  );
}
