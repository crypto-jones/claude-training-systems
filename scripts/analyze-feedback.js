#!/usr/bin/env node

/**
 * analyze-feedback.js
 *
 * Reads trainer session feedback (feedback.csv) and guide context
 * (feedback_meta.json), sends both to Claude, and outputs a structured
 * markdown report with actionable insights for content maintainers.
 *
 * Usage:
 *   node scripts/analyze-feedback.js
 *   node scripts/analyze-feedback.js --csv path/to/feedback.csv
 *   node scripts/analyze-feedback.js --meta path/to/feedback_meta.json
 *   node scripts/analyze-feedback.js --output path/to/report.md
 *   node scripts/analyze-feedback.js --since 2026-02-01   (filter by date)
 *   node scripts/analyze-feedback.js --version 1.1        (filter by guide version)
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from "fs";
import path from "path";

// ── Minimal Anthropic API client (native fetch, no SDK required) ─────────────

async function claudeComplete({ system, userMessage, maxTokens = 4000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("\nError: ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Set it with:  export ANTHROPIC_API_KEY='your-key-here'");
    process.exit(1);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            apiKey,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-5-20250929",
      max_tokens: maxTokens,
      system,
      messages:   [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) throw new Error("Invalid API key (401). Check ANTHROPIC_API_KEY.");
    if (response.status === 429) throw new Error("Rate limit hit (429). Wait a moment and retry.");
    throw new Error(`API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");
}

// ── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return defaultValue;
}

const CSV_PATH  = getArg("--csv",     "feedback.csv");
const META_PATH = getArg("--meta",    "feedback_meta.json");
const OUT_PATH  = getArg("--output",  null);          // null = stdout
const SINCE     = getArg("--since",   null);           // YYYY-MM-DD filter
const VERSION   = getArg("--version", null);           // guide version filter

// ── CSV parser (no dependencies) ────────────────────────────────────────────

function parseCSV(raw) {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV has no data rows.");

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map((line, i) => {
    // Handle quoted fields that may contain commas
    const values = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length !== headers.length) {
      console.warn(`  Warning: row ${i + 2} has ${values.length} values, expected ${headers.length}. Skipping.`);
      return null;
    }

    return headers.reduce((obj, header, idx) => {
      obj[header] = values[idx];
      return obj;
    }, {});
  }).filter(Boolean);
}

// ── Data loading and filtering ───────────────────────────────────────────────

function loadData() {
  // Load CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at '${CSV_PATH}'`);
    console.error("Run with --csv path/to/feedback.csv to specify a custom path.");
    process.exit(1);
  }
  const rawCSV = fs.readFileSync(CSV_PATH, "utf-8");
  let sessions = parseCSV(rawCSV);

  // Load meta
  if (!fs.existsSync(META_PATH)) {
    console.error(`Error: Meta file not found at '${META_PATH}'`);
    console.error("Run with --meta path/to/feedback_meta.json to specify a custom path.");
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(META_PATH, "utf-8"));

  // Apply filters
  if (SINCE) {
    const sinceDate = new Date(SINCE);
    sessions = sessions.filter(s => new Date(s.session_date) >= sinceDate);
    console.log(`  Filtered to sessions since ${SINCE}: ${sessions.length} sessions`);
  }

  if (VERSION) {
    sessions = sessions.filter(s => s.guide_version === VERSION);
    console.log(`  Filtered to version ${VERSION}: ${sessions.length} sessions`);
  }

  if (sessions.length === 0) {
    console.error("Error: No sessions match the current filters.");
    process.exit(1);
  }

  return { sessions, meta };
}

// ── Pre-compute summary statistics ──────────────────────────────────────────
// Doing basic aggregation in JS before sending to Claude reduces token usage
// and gives Claude clean numbers to reason from rather than raw rows.

function computeStats(sessions) {
  const count = sessions.length;
  const totalParticipants = sessions.reduce((sum, s) => sum + parseInt(s.participant_count || 0), 0);

  // Completion rates
  const avgEx1 = sessions.reduce((sum, s) => sum + parseInt(s.ex1_completion_pct || 0), 0) / count;
  const avgEx2 = sessions.reduce((sum, s) => sum + parseInt(s.ex2_completion_pct || 0), 0) / count;

  // Energy averages
  const avgEnergyOpening  = sessions.reduce((sum, s) => sum + parseFloat(s.energy_opening  || 0), 0) / count;
  const avgEnergyExercises= sessions.reduce((sum, s) => sum + parseFloat(s.energy_exercises|| 0), 0) / count;
  const avgEnergyClosing  = sessions.reduce((sum, s) => sum + parseFloat(s.energy_closing  || 0), 0) / count;

  // Energy by format
  const byFormat = {};
  sessions.forEach(s => {
    const fmt = s.delivery_format || "unknown";
    if (!byFormat[fmt]) byFormat[fmt] = { opening: [], exercises: [], closing: [] };
    byFormat[fmt].opening.push(parseFloat(s.energy_opening  || 0));
    byFormat[fmt].exercises.push(parseFloat(s.energy_exercises|| 0));
    byFormat[fmt].closing.push(parseFloat(s.energy_closing  || 0));
  });
  const energyByFormat = {};
  for (const [fmt, data] of Object.entries(byFormat)) {
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    energyByFormat[fmt] = {
      opening:   avg(data.opening).toFixed(2),
      exercises: avg(data.exercises).toFixed(2),
      closing:   avg(data.closing).toFixed(2),
      sessions:  data.opening.length,
    };
  }

  // Bug frequency
  const bugCounts = {};
  sessions.forEach(s => {
    const bug = s.hardest_bug || "unknown";
    bugCounts[bug] = (bugCounts[bug] || 0) + 1;
  });

  // Version split
  const versionCounts = {};
  sessions.forEach(s => {
    const v = s.guide_version || "unknown";
    versionCounts[v] = (versionCounts[v] || 0) + 1;
  });

  // Version performance
  const versionPerf = {};
  sessions.forEach(s => {
    const v = s.guide_version || "unknown";
    if (!versionPerf[v]) versionPerf[v] = { ex1: [], ex2: [], closing: [] };
    versionPerf[v].ex1.push(parseInt(s.ex1_completion_pct || 0));
    versionPerf[v].ex2.push(parseInt(s.ex2_completion_pct || 0));
    versionPerf[v].closing.push(parseFloat(s.energy_closing || 0));
  });
  const versionSummary = {};
  for (const [v, data] of Object.entries(versionPerf)) {
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    versionSummary[v] = {
      sessions:    data.ex1.length,
      avg_ex1:     avg(data.ex1).toFixed(1),
      avg_ex2:     avg(data.ex2).toFixed(1),
      avg_closing: avg(data.closing).toFixed(2),
    };
  }

  // Setup issue rate
  const setupIssueCount = sessions.filter(s => s.setup_issues === "true").length;

  // Questions asked (collect all, flatten)
  const allQuestions = sessions
    .flatMap(s => (s.questions_unanswered || "").split("|").map(q => q.trim()))
    .filter(Boolean);

  // Where room was lost (collect non-empty values)
  const lostRoomAt = sessions
    .map(s => s.lost_room_at)
    .filter(Boolean)
    .filter(v => v !== "");

  // Session highlights
  const highlights = sessions
    .map(s => s.session_highlights)
    .filter(Boolean)
    .filter(v => v !== "");

  return {
    count,
    totalParticipants,
    avgEx1:             avgEx1.toFixed(1),
    avgEx2:             avgEx2.toFixed(1),
    avgEnergyOpening:   avgEnergyOpening.toFixed(2),
    avgEnergyExercises: avgEnergyExercises.toFixed(2),
    avgEnergyClosing:   avgEnergyClosing.toFixed(2),
    energyByFormat,
    bugCounts,
    versionCounts,
    versionSummary,
    setupIssueRate:     `${((setupIssueCount / count) * 100).toFixed(0)}%`,
    allQuestions,
    lostRoomAt,
    highlights,
  };
}

// ── Build the prompt ─────────────────────────────────────────────────────────

function buildPrompt(sessions, stats, meta) {
  const sessionRows = sessions.map(s =>
    `- ${s.session_date} | ${s.trainer_name} | v${s.guide_version} | ${s.delivery_format} | ` +
    `${s.participant_count} participants | ${s.team_context} team | ` +
    `Ex1: ${s.ex1_completion_pct}% | Ex2: ${s.ex2_completion_pct}% | ` +
    `Energy: ${s.energy_opening}/${s.energy_exercises}/${s.energy_closing} (open/ex/close) | ` +
    `Hardest bug: ${s.hardest_bug} | Setup issues: ${s.setup_issues} | ` +
    `Lost room: ${s.lost_room_at || "none"}\n` +
    `  Notes: ${s.trainer_notes}\n` +
    `  Highlight: ${s.session_highlights}\n` +
    `  Questions: ${s.questions_unanswered || "none"}`
  ).join("\n\n");

  return `You are analyzing trainer session feedback for a 60-minute developer workshop on Claude API tool use. Your job is to identify patterns, surface actionable improvements, and help the content team prioritize what to fix.

## Guide Context

Current version: ${meta.current_version}

Sections:
${meta.versions[meta.current_version]?.sections.map(s => `- ${s}`).join("\n")}

Version history:
${Object.entries(meta.versions).map(([v, data]) =>
  `- v${v} (released ${data.released}): ${data.notable_changes}`
).join("\n")}

Exercise bugs (Exercise 1):
${meta.exercises.exercise_1.bugs.map(b => `- ${b}`).join("\n")}

Known problem areas from previous analysis:
${meta.known_problem_areas.map(p => `- ${p}`).join("\n")}

## Pre-Computed Statistics (${stats.count} sessions, ${stats.totalParticipants} total participants)

Exercise completion:
- Exercise 1 average: ${stats.avgEx1}%
- Exercise 2 average: ${stats.avgEx2}%

Energy averages (1-5 scale):
- Opening: ${stats.avgEnergyOpening}
- Exercises: ${stats.avgEnergyExercises}
- Closing: ${stats.avgEnergyClosing}

Energy by delivery format:
${Object.entries(stats.energyByFormat).map(([fmt, data]) =>
  `- ${fmt} (${data.sessions} sessions): opening ${data.opening} / exercises ${data.exercises} / closing ${data.closing}`
).join("\n")}

Hardest bug frequency:
${Object.entries(stats.bugCounts).map(([bug, count]) =>
  `- ${bug}: ${count} sessions (${((count / stats.count) * 100).toFixed(0)}%)`
).join("\n")}

Version performance:
${Object.entries(stats.versionSummary).map(([v, data]) =>
  `- v${v} (${data.sessions} sessions): Ex1 ${data.avg_ex1}% | Ex2 ${data.avg_ex2}% | avg closing energy ${data.avg_closing}`
).join("\n")}

Setup issue rate: ${stats.setupIssueRate} of sessions

Sessions where trainer lost the room: ${stats.lostRoomAt.join(", ") || "none reported"}

All unanswered questions (${stats.allQuestions.length} total):
${stats.allQuestions.map(q => `- ${q}`).join("\n")}

Session highlights (what worked well):
${stats.highlights.map(h => `- ${h}`).join("\n")}

## Individual Session Details

${sessionRows}

## Your Task

Generate a structured analysis report using EXACTLY the following markdown sections. Be specific and evidence-based. Cite session counts and percentages where relevant. Do not include generic recommendations — every recommendation should be grounded in patterns visible in this data.

### Executive Summary
Three sentences maximum. What is the overall health of the workshop program? What is the single most important thing to fix? What is the single most important thing to preserve?

### Top 3 Confusion Points
For each confusion point:
- What the confusion is
- Evidence from the data (which sessions, which bugs, which questions)
- A specific recommended fix (not "improve clarity" — a concrete change to make)

### Energy Analysis
Where are sessions losing the room? Is this a content problem, a delivery problem, or both? Use the format comparison data to separate these. Specific recommendations for any section with average closing energy below 3.0.

### FAQ Updates Needed
Group the unanswered questions into themes. For each theme, write a draft FAQ entry (question + 2-3 sentence answer) that could be added to the facilitator guide immediately.

### Version Correlation
Is v1.1 performing measurably better than v1.0? What do the numbers show? What should be carried forward into v1.2?

### One Thing to Preserve
Based on the session highlights, identify the single pattern that appears across multiple trainers and should be explicitly protected in any content updates. Explain why.

### Priority Action List
Exactly 3 items. Each item should be: actionable this week, specific enough that someone could start on it tomorrow, and ranked by impact. Format as:
1. [Action] — [Why this is #1 priority] — [Estimated effort: Low/Medium/High]
2. [Action] — [Why this is #2 priority] — [Estimated effort: Low/Medium/High]
3. [Action] — [Why this is #3 priority] — [Estimated effort: Low/Medium/High]`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Training Feedback Analyzer");
  console.log("=".repeat(60));

  // Load and validate data
  console.log("\n[1/4] Loading data...");
  const { sessions, meta } = loadData();
  console.log(`  Loaded ${sessions.length} sessions from ${CSV_PATH}`);
  console.log(`  Guide context: v${meta.current_version} (${Object.keys(meta.versions).join(", ")} available)`);

  // Compute statistics
  console.log("\n[2/4] Computing statistics...");
  const stats = computeStats(sessions);
  console.log(`  ${stats.count} sessions | ${stats.totalParticipants} participants`);
  console.log(`  Ex1 avg: ${stats.avgEx1}% | Ex2 avg: ${stats.avgEx2}%`);
  console.log(`  Energy: ${stats.avgEnergyOpening} open / ${stats.avgEnergyExercises} ex / ${stats.avgEnergyClosing} close`);
  console.log(`  ${stats.allQuestions.length} unanswered questions collected`);

  // Build prompt and call Claude
  console.log("\n[3/4] Sending to Claude for analysis...");
  const prompt = buildPrompt(sessions, stats, meta);

  let report;
  try {
    report = await claudeComplete({
      system: `You are an expert instructional designer analyzing trainer feedback for a technical workshop. 
You write clear, direct reports for content maintainers who are busy and need actionable insights, not summaries. 
Every recommendation you make should be specific enough that someone could act on it tomorrow. 
Never write vague guidance like "consider improving" — say exactly what to change and why.`,
      userMessage: prompt,
      maxTokens: 4000,
    });

  } catch (error) {
    console.error(`\nError calling Claude API: ${error.message}`);
    process.exit(1);
  }

  // Build final output with header
  const now = new Date().toISOString().split("T")[0];
  const versionRange = [...new Set(sessions.map(s => s.guide_version))].sort().join(", ");
  const dateRange = [
    sessions.map(s => s.session_date).sort()[0],
    sessions.map(s => s.session_date).sort().at(-1),
  ].filter(Boolean).join(" to ");

  const header = `# Training Program Feedback Analysis

**Generated:** ${now}  
**Sessions analyzed:** ${stats.count} (${dateRange})  
**Guide versions:** ${versionRange}  
**Total participants:** ${stats.totalParticipants}  

---

`;

  const fullReport = header + report;

  // Output
  console.log("\n[4/4] Writing report...");
  if (OUT_PATH) {
    const dir = path.dirname(OUT_PATH);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(OUT_PATH, fullReport, "utf-8");
    console.log(`  Report written to ${OUT_PATH}`);
  } else {
    console.log("\n" + "=".repeat(60) + "\n");
    console.log(fullReport);
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});