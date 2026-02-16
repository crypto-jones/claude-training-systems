'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { VersionCompliance } from '@/app/page';

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: '#f43f5e',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#6b7280',
  OK: '#10b981',
};

export function VersionComplianceChart({ data }: { data: VersionCompliance }) {
  const chartData = data.byUrgency
    .filter((u) => u.count > 0)
    .map((u) => ({ name: u.label, count: u.count, urgency: u.urgency }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-lg font-semibold text-white">
        Compliance by urgency
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Trainer count per notification tier (v{data.latestVersion})
      </p>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#f1f5f9' }}
              formatter={(value: number) => [value, 'Trainers']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={URGENCY_COLORS[entry.urgency] ?? '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
