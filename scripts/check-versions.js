#!/usr/bin/env node

/**
 * check-versions.js
 *
 * Reads trainer records from sample-data/trainer-versions.json,
 * compares each trainer's guide version against the current release,
 * generates ready-to-send email notifications for out-of-date trainers,
 * and writes a full compliance report to output/version-report.md.
 *
 * No external dependencies. No API calls. Pure logic.
 *
 * Usage:
 *   node scripts/check-versions.js
 *   node scripts/check-versions.js --input sample-data/trainer-versions.json
 *   node scripts/check-versions.js --output output/version-report.md
 *   node scripts/check-versions.js --stale-days 60     (override stale threshold)
 *   node scripts/check-versions.js --quiet             (suppress email previews)
 */

import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════════
//  VERSION CONFIG
//  Update this block whenever a new guide version ships.
//  All comparisons are driven from here — no other changes needed.
// ═══════════════════════════════════════════════════════════════════

const VERSION_CONFIG = {
  // The version all trainers should be on right now
  latest_version: "1.2",

  // Ordered list of all versions ever released, oldest → newest
  // Used to calculate how many versions behind a trainer is
  version_history: ["1.0", "1.1", "1.2"],

  // What changed in each version — used in notification emails
  // so trainers know what they missed
  release_notes: {
    "1.0": "Initial release.",
    "1.1": "Section 6 reformatted: pitfalls moved to table format, prose reduced, " +
           "Pitfall 4 moved to Quick Reference Card.",
    "1.2": "Champion Quick-Start section added. Confidence note rewritten to address " +
           "technical question anxiety. Pre-session checklist condensed.",
  },

  // Number of days since last_accessed before a trainer is flagged as stale
  // (separate from version status — a current-version trainer can still be stale)
  stale_threshold_days: 45,

  // Where to get the latest guide
  guide_url: "https://drive.google.com/[your-guide-folder]",

  // Who to contact with questions
  support_contact: "training-team@yourcompany.com",
};

// ═══════════════════════════════════════════════════════════════════
//  CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return defaultValue;
}

const INPUT_PATH    = getArg("--input",      "sample-data/trainer-versions.json");
const OUTPUT_PATH   = getArg("--output",     "output/version-report.md");
const STALE_DAYS    = parseInt(getArg("--stale-days", String(VERSION_CONFIG.stale_threshold_days)));
const QUIET         = args.includes("--quiet");

// ═══════════════════════════════════════════════════════════════════
//  VERSION UTILITIES
// ═══════════════════════════════════════════════════════════════════

function getVersionIndex(version) {
  const idx = VERSION_CONFIG.version_history.indexOf(version);
  if (idx === -1) return null;  // unknown version
  return idx;
}

function versionsBehind(trainerVersion, latestVersion) {
  const trainerIdx = getVersionIndex(trainerVersion);
  const latestIdx  = getVersionIndex(latestVersion);
  if (trainerIdx === null) return null;  // unrecognised version
  return Math.max(0, latestIdx - trainerIdx);
}

// Returns list of version strings the trainer has missed
function missedVersions(trainerVersion) {
  const trainerIdx = getVersionIndex(trainerVersion);
  if (trainerIdx === null) return [];
  return VERSION_CONFIG.version_history.slice(trainerIdx + 1);
}

function statusLabel(behind) {
  if (behind === null) return "UNKNOWN";
  if (behind === 0)    return "CURRENT";
  if (behind === 1)    return "1 VERSION BEHIND";
  return `${behind} VERSIONS BEHIND`;
}

function urgencyLevel(behind, daysSinceAccess) {
  // CRITICAL: 2+ versions behind OR stale AND any version behind
  if (behind >= 2)                              return "CRITICAL";
  if (behind === 1 && daysSinceAccess > STALE_DAYS) return "HIGH";
  if (behind === 1)                             return "MEDIUM";
  if (daysSinceAccess > STALE_DAYS)             return "LOW";   // current but stale
  return "OK";
}

// ═══════════════════════════════════════════════════════════════════
//  DATE UTILITIES
// ═══════════════════════════════════════════════════════════════════

function daysSince(dateString) {
  const past = new Date(dateString);
  const now  = new Date();
  // Zero out time component for clean day comparison
  past.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now - past) / (1000 * 60 * 60 * 24));
}

function formatDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════════════
//  EMAIL GENERATOR
//  Produces ready-to-send plain text emails.
//  Tone: direct and collegial, not corporate-form-letter.
// ═══════════════════════════════════════════════════════════════════

function generateEmail(trainer, analysis) {
  const { behind, missed, daysSince: days, urgency } = analysis;

  const greeting = `Hi ${trainer.name.split(" ")[0]},`;

  // Subject line varies by urgency
  const subjects = {
    CRITICAL: `Action needed: your facilitator guide is ${behind} version${behind > 1 ? "s" : ""} out of date`,
    HIGH:     `Facilitator guide update needed — v${VERSION_CONFIG.latest_version} is available`,
    MEDIUM:   `Facilitator guide update available — v${VERSION_CONFIG.latest_version}`,
  };
  const subject = subjects[urgency] || `Facilitator guide update: v${VERSION_CONFIG.latest_version} available`;

  // Build the "what changed" section
  const changeLines = missed.map(v =>
    `  v${v}: ${VERSION_CONFIG.release_notes[v] || "See release notes."}`
  ).join("\n");

  // Body varies by how far behind they are
  let urgencyLine = "";
  if (urgency === "CRITICAL") {
    urgencyLine = `You're currently on v${trainer.current_version}, which is ${behind} version${behind > 1 ? "s" : ""} behind the current release. We ask that all trainers update before their next session to ensure participants receive consistent, accurate materials.`;
  } else if (urgency === "HIGH") {
    urgencyLine = `You're currently on v${trainer.current_version}. Given that your last session was ${days} days ago, you may be due for a refresh before your next delivery.`;
  } else {
    urgencyLine = `You're currently on v${trainer.current_version}. The update is a quick read — most of the changes are in ${missed.length === 1 ? "one section" : "a few sections"}.`;
  }

  const sessionLine = trainer.sessions_delivered > 0
    ? `Your ${trainer.sessions_delivered} session${trainer.sessions_delivered > 1 ? "s" : ""} to date are logged — thank you for the effort you've put in.`
    : "";

  const body = `${greeting}

${urgencyLine}

Here's what changed since your version:

${changeLines}

You can download the latest guide here:
${VERSION_CONFIG.guide_url}

${sessionLine}

If you have any questions or run into issues with the update, reply to this email or reach the training team at ${VERSION_CONFIG.support_contact}.

Thanks,
Training Team`.trim();

  return { subject, body };
}

// ═══════════════════════════════════════════════════════════════════
//  ANALYSIS ENGINE
//  Processes each trainer record into a structured analysis object.
// ═══════════════════════════════════════════════════════════════════

function analyzeTrainer(trainer) {
  const behind   = versionsBehind(trainer.current_version, VERSION_CONFIG.latest_version);
  const missed   = missedVersions(trainer.current_version);
  const days     = daysSince(trainer.last_accessed);
  const isStale  = days > STALE_DAYS;
  const urgency  = urgencyLevel(behind, days);
  const needsUpdate = behind !== null && behind > 0;
  const email    = needsUpdate ? generateEmail(trainer, { behind, missed, daysSince: days, urgency }) : null;

  return {
    trainer,
    behind,
    missed,
    daysSince: days,
    isStale,
    urgency,
    needsUpdate,
    status: statusLabel(behind),
    email,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  TERMINAL OUTPUT
// ═══════════════════════════════════════════════════════════════════

const URGENCY_COLOURS = {
  CRITICAL: "\x1b[31m",  // red
  HIGH:     "\x1b[33m",  // yellow
  MEDIUM:   "\x1b[36m",  // cyan
  LOW:      "\x1b[34m",  // blue
  OK:       "\x1b[32m",  // green
  RESET:    "\x1b[0m",
  BOLD:     "\x1b[1m",
  DIM:      "\x1b[2m",
};

function coloured(text, ...codes) {
  return codes.map(c => URGENCY_COLOURS[c] || c).join("") + text + URGENCY_COLOURS.RESET;
}

function printComplianceSummary(analyses, stats) {
  const C = URGENCY_COLOURS;

  console.log("\n" + "═".repeat(64));
  console.log(coloured("  VERSION COMPLIANCE REPORT", "BOLD"));
  console.log(coloured(`  Latest version: v${VERSION_CONFIG.latest_version}  |  Generated: ${today()}`, "DIM"));
  console.log("═".repeat(64));

  // ── Per-trainer status table ──────────────────────────────────
  console.log("\n  TRAINER STATUS\n");

  const colW = { name: 20, region: 7, version: 9, status: 22, days: 12, urgency: 10 };

  // Header
  const header = [
    "NAME".padEnd(colW.name),
    "REGION".padEnd(colW.region),
    "VERSION".padEnd(colW.version),
    "STATUS".padEnd(colW.status),
    "LAST ACTIVE".padEnd(colW.days),
    "URGENCY",
  ].join("  ");
  console.log(coloured("  " + header, "DIM"));
  console.log("  " + "─".repeat(header.length));

  // Rows — sorted: CRITICAL → HIGH → MEDIUM → LOW → OK
  const urgencyOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "OK", "UNKNOWN"];
  const sorted = [...analyses].sort((a, b) =>
    urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency)
  );

  for (const a of sorted) {
    const daysLabel = a.daysSince === 0 ? "today"
      : a.daysSince === 1 ? "1 day ago"
      : `${a.daysSince} days ago`;

    const staleFlag = a.isStale ? coloured(" ⚠", "MEDIUM") : "";

    const urgencyColour = { CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", OK: "OK" }[a.urgency] || "DIM";

    const row = [
      a.trainer.name.padEnd(colW.name),
      a.trainer.region.padEnd(colW.region),
      `v${a.trainer.current_version}`.padEnd(colW.version),
      a.status.padEnd(colW.status),
      daysLabel.padEnd(colW.days),
      coloured(a.urgency, urgencyColour),
    ].join("  ");

    console.log("  " + row + staleFlag);
  }

  // ── Summary stats ─────────────────────────────────────────────
  console.log("\n" + "─".repeat(64));
  console.log(coloured("  COMPLIANCE SUMMARY", "BOLD"));
  console.log("─".repeat(64) + "\n");

  const pct = (n) => `${n}/${stats.total} (${Math.round((n / stats.total) * 100)}%)`;

  console.log(`  Total trainers:      ${stats.total}`);
  console.log(`  On latest (v${VERSION_CONFIG.latest_version}):   ${coloured(pct(stats.current), "OK")}`);
  console.log(`  One version behind:  ${coloured(pct(stats.oneBehind), stats.oneBehind > 0 ? "MEDIUM" : "OK")}`);
  console.log(`  Two+ versions behind:${coloured(" " + pct(stats.twoPlusBehind), stats.twoPlusBehind > 0 ? "CRITICAL" : "OK")}`);
  console.log(`  Stale (>${STALE_DAYS}d inactive): ${coloured(pct(stats.stale), stats.stale > 0 ? "LOW" : "OK")}`);
  console.log(`  Notifications queued:${coloured(" " + stats.needsUpdate, "BOLD")}`);

  // ── By region ─────────────────────────────────────────────────
  console.log("\n" + "─".repeat(64));
  console.log(coloured("  COMPLIANCE BY REGION", "BOLD"));
  console.log("─".repeat(64) + "\n");

  for (const [region, regionStats] of Object.entries(stats.byRegion)) {
    const compliance = Math.round((regionStats.current / regionStats.total) * 100);
    const bar = "█".repeat(Math.round(compliance / 10)) + "░".repeat(10 - Math.round(compliance / 10));
    const colour = compliance === 100 ? "OK" : compliance >= 50 ? "MEDIUM" : "CRITICAL";
    console.log(`  ${region.padEnd(8)}  ${coloured(bar, colour)}  ${compliance}% current  (${regionStats.total} trainer${regionStats.total > 1 ? "s" : ""})`);
  }

  // ── Action items ──────────────────────────────────────────────
  if (stats.twoPlusBehind > 0 || stats.oneBehind > 0) {
    console.log("\n" + "─".repeat(64));
    console.log(coloured("  ACTION REQUIRED", "BOLD"));
    console.log("─".repeat(64) + "\n");

    const critical = sorted.filter(a => a.urgency === "CRITICAL");
    const high     = sorted.filter(a => a.urgency === "HIGH");

    if (critical.length > 0) {
      console.log(coloured("  CRITICAL — contact before their next session:", "CRITICAL"));
      critical.forEach(a => {
        console.log(`    • ${a.trainer.name} (${a.trainer.region}) — v${a.trainer.current_version}, last active ${a.daysSince} days ago`);
      });
      console.log();
    }

    if (high.length > 0) {
      console.log(coloured("  HIGH — send notification this week:", "HIGH"));
      high.forEach(a => {
        console.log(`    • ${a.trainer.name} (${a.trainer.region}) — v${a.trainer.current_version}, last active ${a.daysSince} days ago`);
      });
      console.log();
    }
  }
}

function printEmailPreviews(analyses) {
  const outdated = analyses.filter(a => a.needsUpdate);
  if (outdated.length === 0) {
    console.log("\n  All trainers are on the current version. No notifications needed.");
    return;
  }

  console.log("\n" + "═".repeat(64));
  console.log(coloured(`  EMAIL NOTIFICATIONS (${outdated.length} to send)`, "BOLD"));
  console.log("═".repeat(64));

  for (const a of outdated) {
    const { email, trainer, urgency } = a;
    const urgencyColour = { CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM" }[urgency] || "DIM";

    console.log(`\n  ${"─".repeat(60)}`);
    console.log(`  ${coloured("TO:", "BOLD")}      ${trainer.name} <${trainer.email}>`);
    console.log(`  ${coloured("URGENCY:", "BOLD")} ${coloured(urgency, urgencyColour)}`);
    console.log(`  ${coloured("SUBJECT:", "BOLD")} ${email.subject}`);
    console.log(`  ${coloured("BODY:", "BOLD")}`);
    console.log();
    email.body.split("\n").forEach(line => console.log(`    ${line}`));
  }
}

// ═══════════════════════════════════════════════════════════════════
//  MARKDOWN REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════

function generateMarkdownReport(analyses, stats) {
  const urgencyOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "OK", "UNKNOWN"];
  const sorted = [...analyses].sort((a, b) =>
    urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency)
  );

  const pct = (n) => `${n}/${stats.total} (${Math.round((n / stats.total) * 100)}%)`;

  // ── Header ────────────────────────────────────────────────────
  let md = `# Version Compliance Report

**Generated:** ${today()}
**Latest version:** v${VERSION_CONFIG.latest_version}
**Trainers tracked:** ${stats.total}

---

## Compliance Summary

| Metric | Count |
|---|---|
| On latest version (v${VERSION_CONFIG.latest_version}) | ${pct(stats.current)} |
| One version behind | ${pct(stats.oneBehind)} |
| Two or more versions behind | ${pct(stats.twoPlusBehind)} |
| Stale (inactive >${STALE_DAYS} days) | ${pct(stats.stale)} |
| Notifications queued | ${stats.needsUpdate} |

`;

  // ── By region ─────────────────────────────────────────────────
  md += `## Compliance by Region\n\n`;
  md += `| Region | Current | Total | Compliance |\n`;
  md += `|---|---|---|---|\n`;
  for (const [region, rs] of Object.entries(stats.byRegion)) {
    const compliance = Math.round((rs.current / rs.total) * 100);
    md += `| ${region} | ${rs.current} | ${rs.total} | ${compliance}% |\n`;
  }
  md += "\n---\n\n";

  // ── Full trainer table ────────────────────────────────────────
  md += `## Trainer Status\n\n`;
  md += `| Name | Region | Version | Status | Last Active | Sessions | Urgency |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const a of sorted) {
    const daysLabel = a.daysSince === 0 ? "Today"
      : a.daysSince === 1 ? "1 day ago"
      : `${a.daysSince} days ago`;
    const staleFlag = a.isStale ? " ⚠" : "";

    md += `| ${a.trainer.name} | ${a.trainer.region} | v${a.trainer.current_version} | ${a.status} | ${daysLabel}${staleFlag} | ${a.trainer.sessions_delivered} | ${a.urgency} |\n`;
  }
  md += "\n---\n\n";

  // ── Email notifications ───────────────────────────────────────
  const outdated = sorted.filter(a => a.needsUpdate);

  if (outdated.length > 0) {
    md += `## Email Notifications (${outdated.length})\n\n`;
    md += `Ready to send. Copy each block and paste into your email client or bulk sender.\n\n`;

    for (const a of outdated) {
      const { email, trainer, urgency } = a;
      md += `### ${trainer.name} — ${urgency}\n\n`;
      md += `**To:** ${trainer.name} <${trainer.email}>\n`;
      md += `**Subject:** ${email.subject}\n\n`;
      md += "```\n";
      md += email.body;
      md += "\n```\n\n";
    }
  } else {
    md += `## Email Notifications\n\nAll trainers are on the current version. No notifications required.\n\n`;
  }

  // ── Version history reference ─────────────────────────────────
  md += `---\n\n## Version History\n\n`;
  for (const [v, notes] of Object.entries(VERSION_CONFIG.release_notes)) {
    const isCurrent = v === VERSION_CONFIG.latest_version;
    md += `**v${v}**${isCurrent ? " *(current)*" : ""}: ${notes}\n\n`;
  }

  return md;
}

// ═══════════════════════════════════════════════════════════════════
//  AGGREGATE STATS
// ═══════════════════════════════════════════════════════════════════

function computeStats(analyses) {
  const total       = analyses.length;
  const current     = analyses.filter(a => a.behind === 0).length;
  const oneBehind   = analyses.filter(a => a.behind === 1).length;
  const twoPlusBehind = analyses.filter(a => a.behind !== null && a.behind >= 2).length;
  const stale       = analyses.filter(a => a.isStale).length;
  const needsUpdate = analyses.filter(a => a.needsUpdate).length;

  // Group by region
  const byRegion = {};
  for (const a of analyses) {
    const r = a.trainer.region || "Unknown";
    if (!byRegion[r]) byRegion[r] = { total: 0, current: 0 };
    byRegion[r].total++;
    if (a.behind === 0) byRegion[r].current++;
  }

  return { total, current, oneBehind, twoPlusBehind, stale, needsUpdate, byRegion };
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════

function main() {
  // ── Load data ─────────────────────────────────────────────────
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`\nError: Input file not found: '${INPUT_PATH}'`);
    console.error("Usage: node check-versions.js --input path/to/trainer-versions.json");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(INPUT_PATH, "utf-8"));
  } catch (e) {
    console.error(`\nError: Could not parse JSON from '${INPUT_PATH}': ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(data.trainers) || data.trainers.length === 0) {
    console.error("\nError: JSON must have a non-empty 'trainers' array.");
    process.exit(1);
  }

  // Validate required fields
  const required = ["name", "email", "current_version", "last_accessed"];
  const invalid = data.trainers.filter(t =>
    required.some(f => !t[f])
  );
  if (invalid.length > 0) {
    console.error(`\nError: ${invalid.length} trainer record(s) are missing required fields.`);
    console.error(`Required: ${required.join(", ")}`);
    invalid.forEach(t => console.error(`  Missing fields in: ${JSON.stringify(t)}`));
    process.exit(1);
  }

  // ── Analyse ───────────────────────────────────────────────────
  const analyses = data.trainers.map(analyzeTrainer);
  const stats    = computeStats(analyses);

  // ── Terminal output ───────────────────────────────────────────
  printComplianceSummary(analyses, stats);

  if (!QUIET) {
    printEmailPreviews(analyses);
  } else {
    const outdated = analyses.filter(a => a.needsUpdate);
    if (outdated.length > 0) {
      console.log(`\n  ${outdated.length} email notification(s) ready. Run without --quiet to preview.`);
    }
  }

  // ── Write markdown report ─────────────────────────────────────
  const reportDir = path.dirname(OUTPUT_PATH);
  if (reportDir && !fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const markdown = generateMarkdownReport(analyses, stats);
  fs.writeFileSync(OUTPUT_PATH, markdown, "utf-8");

  console.log("\n" + "═".repeat(64));
  console.log(`  Report saved: ${OUTPUT_PATH}`);
  console.log("═".repeat(64) + "\n");
}

main();