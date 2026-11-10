// A small trend line for a card: the shape of the last weeks, no axes. The figures it summarises
// are printed next to it, and the full chart with a table view is further down the page.
export default function Sparkline({points, width = 120, height = 36, className, label}) {
  if (!points || points.length < 2) return null;
  const values = points.map(point => point.sell), min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1, pad = 3;
  const x = index => pad + index * (width - pad * 2) / (points.length - 1);
  const y = value => pad + (max - value) * (height - pad * 2) / span;
  const line = points.map((point, index) => (index ? 'L' : 'M') + x(index).toFixed(1) + ' ' + y(point.sell).toFixed(1)).join(' ');
  const area = line + ' L' + x(points.length - 1).toFixed(1) + ' ' + height + ' L' + x(0).toFixed(1) + ' ' + height + ' Z';
  const last = points.length - 1;
  return <svg className={className} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} style={{direction: 'ltr'}}>
    <path d={area} fill="currentColor" opacity=".1"/>
    <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    <circle cx={x(last)} cy={y(points[last].sell)} r="3" fill="currentColor"/>
  </svg>;
}
