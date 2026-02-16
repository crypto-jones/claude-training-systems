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
import type { VersionCompliance } from '@/app/page';

export function ComplianceByRegionChart({ data }: { data: VersionCompliance }) {
  const chartData = data.byRegion.map((r) => ({
    region: r.region,
    compliance: r.compliancePct,
    current: r.current,
    total: r.total,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-lg font-semibold text-white">
        Compliance by region
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        % on latest version · target 90%
      </p>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey="region"
              tick={{ fill: '#e2e8f0', fontSize: 13 }}
            />
            <YAxis
              tick={{ fill: '#e2e8f0', fontSize: 13 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" />
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
              formatter={(value: number) => [value, 'Compliance %']}
              labelFormatter={(label, payload) =>
                payload[0]?.payload
                  ? `${label} — ${payload[0].payload.current}/${payload[0].payload.total} current`
                  : label
              }
            />
            <Bar
              dataKey="compliance"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
