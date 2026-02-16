'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FeedbackTrends } from '@/app/page';

export function FeedbackTrendsChart({ data }: { data: FeedbackTrends }) {
  const series = data.byWeek.filter((w) => w.sessions > 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-lg font-semibold text-white">
        Weekly trends
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        Exercise completion and closing energy by week
      </p>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fill: '#e2e8f0', fontSize: 13 }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: '#e2e8f0', fontSize: 13 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: '#e2e8f0', fontSize: 13 }}
              domain={[0, 5]}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #475569',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#f8fafc',
              }}
              labelStyle={{ color: '#f8fafc', fontWeight: 500 }}
              itemStyle={{ color: '#e2e8f0' }}
              formatter={(value, name) => {
                const num = typeof value === 'number' ? value : null;
                if (num == null) return ['-', name];
                if (name === 'avgClosingEnergy') return [num.toFixed(1), 'Closing energy'];
                return [num, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '13px' }}
              formatter={(value) => (
                <span className="text-slate-300">{value}</span>
              )}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ex1CompletionPct"
              name="Ex 1 completion %"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6' }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ex2CompletionPct"
              name="Ex 2 completion %"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgClosingEnergy"
              name="Closing energy"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
