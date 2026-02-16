'use client';

import type { VersionCompliance, FeedbackMetrics, FaqSla } from '@/app/page';

export function KpiCards({
  versionCompliance,
  feedbackMetrics,
  faqSla,
}: {
  versionCompliance: VersionCompliance;
  feedbackMetrics: FeedbackMetrics;
  faqSla: FaqSla;
}) {
  const compliancePct = Math.round(
    (versionCompliance.summary.onLatest / versionCompliance.summary.totalTrainers) * 100
  );
  const complianceOnTarget = compliancePct >= 90;
  const ex1OnTarget = feedbackMetrics.exercise1CompletionPct >= feedbackMetrics.targets.exercise1;
  const ex2OnTarget = feedbackMetrics.exercise2CompletionPct >= feedbackMetrics.targets.exercise2;
  const energyOnTarget = feedbackMetrics.averageClosingEnergy >= feedbackMetrics.targets.closingEnergy;
  const submissionOnTarget = feedbackMetrics.feedbackSubmissionRatePct >= feedbackMetrics.targets.submissionRate;
  const faqOnTarget = faqSla.slaAdherencePct >= 100;

  const cards = [
    {
      label: 'Version compliance',
      value: `${compliancePct}%`,
      sub: `${versionCompliance.summary.onLatest}/${versionCompliance.summary.totalTrainers} on v${versionCompliance.latestVersion}`,
      onTarget: complianceOnTarget,
      target: 'Target >90%',
    },
    {
      label: 'Exercise 1 completion',
      value: `${feedbackMetrics.exercise1CompletionPct.toFixed(1)}%`,
      sub: `${feedbackMetrics.sessionsTotal} sessions`,
      onTarget: ex1OnTarget,
      target: `Target >${feedbackMetrics.targets.exercise1}%`,
    },
    {
      label: 'Exercise 2 attempt rate',
      value: `${feedbackMetrics.exercise2CompletionPct.toFixed(1)}%`,
      sub: `${feedbackMetrics.sessionsTotal} sessions`,
      onTarget: ex2OnTarget,
      target: `Target >${feedbackMetrics.targets.exercise2}%`,
    },
    {
      label: 'Avg closing energy',
      value: feedbackMetrics.averageClosingEnergy.toFixed(1),
      sub: 'out of 5.0',
      onTarget: energyOnTarget,
      target: `Target ≥${feedbackMetrics.targets.closingEnergy}`,
    },
    {
      label: 'Feedback submission',
      value: `${feedbackMetrics.feedbackSubmissionRatePct}%`,
      sub: 'of sessions',
      onTarget: submissionOnTarget,
      target: `Target >${feedbackMetrics.targets.submissionRate}%`,
    },
    {
      label: 'FAQ SLA adherence',
      value: `${faqSla.slaAdherencePct}%`,
      sub: `${faqSla.questionsAnsweredWithinSla}/${faqSla.questionsLogged} within ${faqSla.slaDays}d`,
      onTarget: faqOnTarget,
      target: '100%',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-300">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white">
            {card.value}
          </p>
          <p className="mt-1 text-sm text-slate-300">{card.sub}</p>
          <p
            className={`mt-2 text-sm font-medium ${card.onTarget ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {card.onTarget ? 'On target' : 'Below target'} · {card.target}
          </p>
        </div>
      ))}
    </div>
  );
}
