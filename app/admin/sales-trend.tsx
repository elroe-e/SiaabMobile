'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function SalesTrend({ data }: { data: Array<{ day: string; amount: number }> }) {
  return <div className="admin-chart">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 9, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#edf0f4" vertical={false} />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8791a1', fontSize: 9 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8791a1', fontSize: 8 }} width={48} tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} />
        <Tooltip formatter={(value) => [`ETB ${Number(value).toLocaleString()}`, 'Sales']} contentStyle={{ border: '1px solid #e4e8ef', borderRadius: 7, fontSize: 10 }} />
        <Line type="monotone" dataKey="amount" stroke="#2362db" strokeWidth={2.5} dot={{ r: 3, fill: '#2362db', strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
}
