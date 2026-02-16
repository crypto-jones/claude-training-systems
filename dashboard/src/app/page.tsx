import fs from 'fs';
import path from 'path';
import { KpiCards } from '@/components/KpiCards';
import { VersionComplianceChart } from '@/components/VersionComplianceChart';
import { FeedbackMetricsChart } from '@/components/FeedbackMetricsChart';
import { FeedbackTrendsChart } from '@/components/FeedbackTrendsChart';
import { SectionEnergyChart } from '@/components/SectionEnergyChart';
import { ComplianceByRegionChart } from '@/components/ComplianceByRegionChart';

function loadJson<T>(filename: string): T {
  const filePath = path.join(process.cwd(), 'public', 'data', filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

export default function DashboardPage() {
  const versionCompliance = loadJson<VersionCompliance>('version-compliance.json');
  const feedbackMetrics = loadJson<FeedbackMetrics>('feedback-metrics.json');
  const feedbackTrends = loadJson<FeedbackTrends>('feedback-trends.json');
  const sectionEnergy = loadJson<SectionEnergy>('section-energy.json');
  const faqSla = loadJson<FaqSla>('faq-sla.json');

  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Training Content Systems
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Version compliance, feedback metrics, and health indicators
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Data as of {versionCompliance.generated} · Sample data for demo
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <KpiCards
          versionCompliance={versionCompliance}
          feedbackMetrics={feedbackMetrics}
          faqSla={faqSla}
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <VersionComplianceChart data={versionCompliance} />
          <ComplianceByRegionChart data={versionCompliance} />
        </div>

        <div className="mt-8">
          <FeedbackMetricsChart data={feedbackMetrics} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <FeedbackTrendsChart data={feedbackTrends} />
          <SectionEnergyChart data={sectionEnergy} />
        </div>
      </div>
    </main>
  );
}

// Types for loaded JSON (match public/data/*.json)
export interface VersionCompliance {
  generated: string;
  latestVersion: string;
  summary: {
    totalTrainers: number;
    onLatest: number;
    oneBehind: number;
    twoPlusBehind: number;
    stale: number;
    notificationsQueued: number;
  };
  byRegion: Array<{ region: string; current: number; total: number; compliancePct: number }>;
  byUrgency: Array<{ urgency: string; count: number; label: string }>;
  trainers: Array<{
    name: string;
    region: string;
    version: string;
    status: string;
    daysSinceAccess: number;
    sessionsDelivered: number;
    urgency: string;
  }>;
}

export interface FeedbackMetrics {
  generated: string;
  period: { from: string; to: string };
  sessionsTotal: number;
  exercise1CompletionPct: number;
  exercise2CompletionPct: number;
  averageClosingEnergy: number;
  feedbackSubmissionRatePct: number;
  unansweredQuestionsPerSession: number;
  setupIssueRatePct?: number;
  targets: {
    exercise1: number;
    exercise2: number;
    closingEnergy: number;
    submissionRate: number;
    unansweredMax: number;
  };
}

export interface FeedbackTrends {
  generated: string;
  byWeek: Array<{
    week: string;
    weekLabel: string;
    sessions: number;
    ex1CompletionPct: number | null;
    ex2CompletionPct: number | null;
    avgClosingEnergy: number | null;
  }>;
  byVersion: Array<{
    version: string;
    sessions: number;
    ex1CompletionPct: number;
    ex2CompletionPct: number;
    avgClosingEnergy: number;
  }>;
}

export interface SectionEnergy {
  generated: string;
  sections: Array<{ name: string; avgEnergy: number; target: number }>;
}

export interface FaqSla {
  generated: string;
  period: { from: string; to: string };
  questionsLogged: number;
  questionsAnsweredWithinSla: number;
  slaAdherencePct: number;
  avgDaysToAnswer: number;
  slaDays: number;
}
