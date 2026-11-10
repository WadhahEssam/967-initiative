'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {ChartNoAxesCombined} from 'lucide-react';
import {formatNumber, formatYear, formatCompact} from '@/lib/format';
import {fillAnnualGaps} from '@/lib/yemenNumbers';

function StatTooltip({active, payload, label, unit}) {
  if (!active || !payload?.length || payload[0].value === null) return null;
  const row = payload[0].payload;
  return <div className="stat-chart-tooltip">
    <strong>{formatYear(label)}</strong>
    <span dir="ltr">{formatNumber(payload[0].value, {maximumFractionDigits: 3})} {unit}</span>
    {row.source?.name && <small>{row.source.name}</small>}
  </div>;
}

export default function IndicatorChart({values, unit, type = 'line', height = 360}) {
  if (!values?.length) return <div className="stat-chart-empty"><ChartNoAxesCombined size={30}/><p>لا توجد قيم منشورة لرسم هذا المؤشر بعد.</p></div>;
  const data = fillAnnualGaps(values);
  const common = <>
    <CartesianGrid stroke="#d9dfd9" vertical={false}/>
    <XAxis dataKey="year" tickFormatter={formatYear} stroke="#5e6b6d" tickLine={false}/>
    <YAxis tickFormatter={value => formatCompact(value)} stroke="#5e6b6d" tickLine={false} width={64}/>
    <Tooltip content={<StatTooltip unit={unit}/>}/>
  </>;
  return <div className="stat-chart" style={{height}} role="group" aria-label={`رسم زمني للمؤشر بوحدة ${unit}`}>
    <ResponsiveContainer width="100%" height="100%">
      {type === 'bar' ? <BarChart data={data}>{common}<Bar dataKey="value" fill="#176b75" radius={[3, 3, 0, 0]}/></BarChart>
        : type === 'area' ? <AreaChart data={data}>{common}<Area dataKey="value" type="monotone" stroke="#176b75" fill="#176b7525" strokeWidth={2.5} connectNulls={false}/></AreaChart>
          : <LineChart data={data}>{common}<Line dataKey="value" type="monotone" stroke="#176b75" strokeWidth={3} dot={{r: 4, fill: '#ffffff', strokeWidth: 2}} activeDot={{r: 6}} connectNulls={false}/></LineChart>}
    </ResponsiveContainer>
  </div>;
}
