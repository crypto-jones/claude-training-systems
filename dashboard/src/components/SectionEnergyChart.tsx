'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { SectionEnergy } from '@/app/page';

export function SectionEnergyChart({ data }: { data: SectionEnergy }) {
  const chartData = data.sections.map((s) => ({
    name: s.name,
    energy: s.avgEnergy,
    target: s.target,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-lg font-semibold text-white">
        Energy by phase
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Average participant energy (1–5) · target ≥3.0
      </p>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              domain={[0, 5]}
            />
            <ReferenceLine y={3} stroke="#10b981" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [value.toFixed(1), 'Avg energy']}
            />
            <Bar
              dataKey="energy"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={64}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
