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
import type { FeedbackMetrics } from '@/app/page';

export function FeedbackMetricsChart({ data }: { data: FeedbackMetrics }) {
  const { targets } = data;
  // Normalize closing energy to 0–100 scale (3.0 target = 60%) for same-axis comparison
  const closingEnergyPct = Math.round((data.averageClosingEnergy / 5) * 100);
  const closingTargetPct = (targets.closingEnergy / 5) * 100;
  const chartData = [
    {
      name: 'Exercise 1 completion',
      value: data.exercise1CompletionPct,
      target: targets.exercise1,
      fill: data.exercise1CompletionPct >= targets.exercise1 ? '#10b981' : '#f59e0b',
    },
    {
      name: 'Exercise 2 attempt',
      value: data.exercise2CompletionPct,
      target: targets.exercise2,
      fill: data.exercise2CompletionPct >= targets.exercise2 ? '#10b981' : '#f59e0b',
    },
    {
      name: 'Closing energy (out of 5)',
      value: closingEnergyPct,
      target: closingTargetPct,
      raw: data.averageClosingEnergy,
      fill: data.averageClosingEnergy >= targets.closingEnergy ? '#10b981' : '#f59e0b',
    },
    {
      name: 'Feedback submission',
      value: data.feedbackSubmissionRatePct,
      target: targets.submissionRate,
      fill: data.feedbackSubmissionRatePct >= targets.submissionRate ? '#10b981' : '#f59e0b',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-lg font-semibold text-white">
        Session feedback health
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Key metrics vs targets · {data.sessionsTotal} sessions in period
      </p>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 160, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={155}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
              }}
              formatter={(value: number, name, props) => {
                const d = props.payload as { name: string; raw?: number };
                if (d.raw != null) return [`${d.raw.toFixed(1)} / 5.0`, 'Closing energy'];
                return [value, 'Value'];
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Unanswered questions/session: {data.unansweredQuestionsPerSession.toFixed(1)} (target &lt;{data.targets.unansweredMax})
      </p>
    </div>
  );
}
