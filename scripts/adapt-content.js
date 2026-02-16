#!/usr/bin/env node

/**
 * adapt-content.js
 *
 * Takes a section of the facilitator guide (markdown) and generates
 * two audience-specific variants using Claude:
 *   - [section-name]-beginners.md  (less API experience, more scaffolding)
 *   - [section-name]-advanced.md   (senior devs, faster pace, edge cases)
 *
 * Usage:
 *   node adapt-content.js --input section2-core-concepts.md
 *   node adapt-content.js --input section2.md --output-dir custom/path
 *   node adapt-content.js --input section2.md --audience beginners
 *   node adapt-content.js --input section2.md --audience advanced
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from "fs";
import path from "path";

// ── CLI argument parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) return args[index + 1];
  return defaultValue;
}

const INPUT_PATH  = getArg("--input",      null);
const OUTPUT_DIR  = getArg("--output-dir", "output");
const AUDIENCE    = getArg("--audience",   "both");   // "beginners" | "advanced" | "both"

// ── Native fetch API client ──────────────────────────────────────────────────

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
      "Content-Type":       "application/json",
      "x-api-key":          apiKey,
      "anthropic-version":  "2023-06-01",
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

// ── Audience profiles ────────────────────────────────────────────────────────
// These are passed to Claude as detailed personas. The more specific the
// profile, the more consistent the adaptation across different sections.

const AUDIENCE_PROFILES = {
  beginners: {
    label: "Beginners",
    filename_suffix: "beginners",
    persona: `
AUDIENCE: Developers with limited API experience
- May have used REST APIs but haven't built systems that call external services programmatically
- Comfortable reading code but not necessarily writing it from scratch under time pressure
- Unfamiliar with concepts like async/await patterns, JSON schema, or message-based APIs
- May not know what an SDK is or why you'd use one
- Prone to anxiety when things don't work immediately — need reassurance that errors are normal
- Benefit from analogies that connect new concepts to things they already know
- Need to understand WHY before they can absorb HOW
`.trim(),
    adaptations: `
ADAPTATIONS TO MAKE:
1. ANALOGIES: Add at least one analogy per major concept that connects to everyday experience
   - Example: The two-round-trip pattern → "Like placing an order at a restaurant: you tell the waiter what you want (round 1), the kitchen prepares it, the waiter brings it back (round 2). The chef never comes to your table."
2. SLOWER PACING: Break multi-step concepts into numbered steps. Never assume "this is obvious."
3. CODE COMMENTS: Add explanatory comments to every non-trivial line of code. Comments should explain intent, not just what the code does.
   - Instead of: # Create client  →  # Create the API client that handles authentication and talking to Claude
4. REASSURANCE: Add brief normalising phrases where learners typically get stuck or feel lost.
   - "This is the part that surprises almost everyone the first time."
   - "If you got an error here, that's expected — keep reading."
5. EXPLICIT TRANSITIONS: State clearly when one concept ends and another begins.
   - "Now that you understand X, let's look at Y."
6. VOCABULARY: Define any technical term the first time it appears. Use plain English alternatives where possible.
7. CONTEXT: Add "why this matters" framing before each new concept. Don't assume motivation is obvious.
8. SIMPLIFY CODE EXAMPLES: Remove advanced patterns (list comprehensions, complex one-liners) and replace with explicit loops and variables. Prioritise readability over concision.
`.trim(),
  },

  advanced: {
    label: "Advanced",
    filename_suffix: "advanced",
    persona: `
AUDIENCE: Senior developers with strong API and systems experience
- Comfortable with async patterns, JSON schema, REST APIs, and SDK usage
- Have likely used OpenAI function calling or similar tool-use patterns
- Read code faster than prose — prefer to see the code first, explanation after if at all
- Will feel condescended to by over-explanation; lose trust in material that explains the obvious
- Interested in edge cases, failure modes, production considerations, and performance implications
- Want to know what's different about Claude's approach vs alternatives they already know
- Motivated by knowing what can go wrong, not just what should go right
`.trim(),
    adaptations: `
ADAPTATIONS TO MAKE:
1. COMPRESS BASICS: Remove or heavily condense explanations of concepts a senior dev already knows.
   - Remove: what JSON is, what an API key is, what a function is
   - Compress: basic API call patterns (one sentence max)
2. LEAD WITH CODE: Show the code first. Explanation comes after, and only if the code isn't self-explanatory.
3. ADD EDGE CASES: For each major pattern, add a subsection on what breaks it or where it fails in production.
   - Parallel tool calls where one result is slow
   - max_tokens truncation mid-tool-use block
   - Claude requesting a tool that wasn't defined
   - Schema validation failures and how to catch them
4. PRODUCTION CONTEXT: Add notes on what this looks like at scale.
   - Token costs of tool schemas on every request
   - Retry strategies when tool execution fails
   - Observability: what to log for debugging tool use issues
5. COMPARE TO ALTERNATIVES: Where relevant, note how Claude's approach differs from OpenAI function calling or other patterns they may know.
6. REMOVE REASSURANCE: Cut normalising phrases — they read as patronising to this audience.
7. COMPRESS EXERCISES: Describe the exercise goal and constraints; skip the hand-holding setup instructions.
8. ADVANCED CODE PATTERNS: Use idiomatic Python where appropriate. List comprehensions, generators, and concise patterns are fine.
`.trim(),
  },
};

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildAdaptationPrompt(content, audienceKey) {
  const profile = AUDIENCE_PROFILES[audienceKey];

  return `You are adapting a facilitator guide section for a Claude API tool use workshop. 
Your job is to rewrite the provided section for a specific audience while preserving all the technical accuracy and core content.

## Target Audience

${profile.persona}

## How to Adapt This Content

${profile.adaptations}

## What to PRESERVE (do not change these)
- All technical content: code examples, API patterns, exact parameter names, error types
- The section structure and sequence of concepts
- Trainer scripts marked with "Say this:" or in green boxes — adapt the FRAMING but keep the instructional intent
- All timing guidance and section labels
- Bug descriptions and fix explanations (Exercise sections)
- Any code that participants will run — functional correctness is non-negotiable

## What to CHANGE
- Explanation depth and pacing (as specified in adaptations above)
- Code comment density and style
- Analogies and framing (add or remove as appropriate for this audience)
- Transition language and signposting
- The amount of "why" context before each concept

## Output Format
- Output valid markdown only
- Begin with a metadata header block:
  \`\`\`
  <!-- AUDIENCE: ${profile.label} -->
  <!-- ADAPTED: [today's date] -->
  <!-- SOURCE: [infer section name from content] -->
  \`\`\`
- Then the adapted content
- Do not add commentary about what you changed — just output the adapted section

## Section to Adapt

${content}`;
}

// ── Section name extractor ───────────────────────────────────────────────────
// Derives a clean filename slug from the input file or first heading.

function extractSectionName(filePath, content) {
  // Try to get name from first H1 or H2 heading
  const headingMatch = content.match(/^#{1,2}\s+(.+)$/m);
  if (headingMatch) {
    let title = headingMatch[1];
    // Strip timing suffixes like "(Minutes 5–15)" or "— Subtitle"
    title = title.replace(/\s*[\(—–-].*$/, "").trim();
    // Strip leading "Section N:" prefix
    title = title.replace(/^section\s+\d+\s*:\s*/i, "").trim();
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40)
      .replace(/-$/, "");
  }

  // Fall back to input filename without extension
  return path.basename(filePath, path.extname(filePath));
}

// ── File writer ──────────────────────────────────────────────────────────────

function writeOutput(content, outputDir, sectionName, audienceKey) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${sectionName}-${AUDIENCE_PROFILES[audienceKey].filename_suffix}.md`;
  const fullPath = path.join(outputDir, filename);
  fs.writeFileSync(fullPath, content, "utf-8");
  return fullPath;
}

// ── Validation ───────────────────────────────────────────────────────────────
// Basic sanity checks on the adapted output before saving.
// Catches cases where Claude returned an apology or meta-commentary
// instead of adapted content.

function validateOutput(original, adapted, audienceKey) {
  const warnings = [];

  // Must be a reasonable length relative to original
  const ratio = adapted.length / original.length;
  if (ratio < 0.4) {
    warnings.push(`Output is very short (${(ratio * 100).toFixed(0)}% of original). May be incomplete.`);
  }
  if (ratio > 3.0) {
    warnings.push(`Output is very long (${(ratio * 100).toFixed(0)}% of original). May contain unwanted additions.`);
  }

  // Should contain the metadata header
  if (!adapted.includes("<!-- AUDIENCE:")) {
    warnings.push("Missing metadata header block. Claude may have ignored the format instruction.");
  }

  // Should still contain code blocks if original had them
  const originalCodeBlocks = (original.match(/```/g) || []).length;
  const adaptedCodeBlocks  = (adapted.match(/```/g) || []).length;
  if (originalCodeBlocks > 0 && adaptedCodeBlocks === 0) {
    warnings.push("Code blocks missing from output. Technical content may have been lost.");
  }

  // Advanced variant should not be longer than original (usually compresses)
  if (audienceKey === "advanced" && ratio > 1.5) {
    warnings.push("Advanced variant is significantly longer than original. Check for over-explanation.");
  }

  // Beginner variant should not be shorter than original (usually expands)
  if (audienceKey === "beginners" && ratio < 0.8) {
    warnings.push("Beginner variant is shorter than original. Check that explanations were added, not removed.");
  }

  return warnings;
}

// ── Diff summary ─────────────────────────────────────────────────────────────
// Prints a lightweight summary of what changed so the user can
// quickly judge whether the adaptation looks right without opening files.

function printDiffSummary(original, adapted, audienceKey) {
  const originalLines = original.split("\n").length;
  const adaptedLines  = adapted.split("\n").length;
  const lineDelta     = adaptedLines - originalLines;

  const originalCodeBlocks = (original.match(/```[\s\S]*?```/g) || []).length;
  const adaptedCodeBlocks  = (adapted.match(/```[\s\S]*?```/g) || []).length;

  const originalWords = original.split(/\s+/).length;
  const adaptedWords  = adapted.split(/\s+/).length;
  const wordDelta     = adaptedWords - originalWords;

  // Count comment lines in code blocks
  const countComments = (text) =>
    (text.match(/```[\s\S]*?```/g) || [])
      .join("\n")
      .split("\n")
      .filter(l => l.trim().startsWith("#")).length;

  const originalComments = countComments(original);
  const adaptedComments  = countComments(adapted);

  console.log(`    Lines:     ${originalLines} → ${adaptedLines} (${lineDelta >= 0 ? "+" : ""}${lineDelta})`);
  console.log(`    Words:     ${originalWords} → ${adaptedWords} (${wordDelta >= 0 ? "+" : ""}${wordDelta})`);
  console.log(`    Code blocks: ${originalCodeBlocks} → ${adaptedCodeBlocks}`);
  console.log(`    Code comments: ${originalComments} → ${adaptedComments}`);

  // Audience-specific expectations
  if (audienceKey === "beginners") {
    const commentIncrease = adaptedComments > originalComments;
    const wordIncrease    = adaptedWords > originalWords;
    console.log(`    ✓ More words than original: ${wordIncrease ? "yes" : "NO — check output"}`);
    console.log(`    ✓ More code comments: ${commentIncrease ? "yes" : "NO — check output"}`);
  } else {
    const wordDecrease = adaptedWords < originalWords;
    console.log(`    ✓ Fewer words than original: ${wordDecrease ? "yes" : "NO — check output"}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Content Adaptation Tool");
  console.log("=".repeat(60));

  // Validate inputs
  if (!INPUT_PATH) {
    console.error("\nError: --input is required.");
    console.error("Usage: node adapt-content.js --input section.md");
    console.error("       node adapt-content.js --input section.md --audience beginners");
    console.error("       node adapt-content.js --input section.md --output-dir custom/path");
    process.exit(1);
  }

  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`\nError: Input file not found: '${INPUT_PATH}'`);
    process.exit(1);
  }

  if (!["both", "beginners", "advanced"].includes(AUDIENCE)) {
    console.error(`\nError: --audience must be 'beginners', 'advanced', or 'both'. Got: '${AUDIENCE}'`);
    process.exit(1);
  }

  // Load content
  console.log(`\n[1/4] Loading content...`);
  const content = fs.readFileSync(INPUT_PATH, "utf-8");
  const sectionName = extractSectionName(INPUT_PATH, content);
  const wordCount = content.split(/\s+/).length;

  console.log(`  File:    ${INPUT_PATH}`);
  console.log(`  Section: ${sectionName}`);
  console.log(`  Length:  ${wordCount} words, ${content.split("\n").length} lines`);

  if (wordCount > 8000) {
    console.warn(`\n  Warning: Input is ${wordCount} words. Very long sections may produce incomplete output.`);
    console.warn("  Consider splitting the section before adapting.");
  }

  // Determine which audiences to generate
  const audiencesToRun = AUDIENCE === "both"
    ? ["beginners", "advanced"]
    : [AUDIENCE];

  console.log(`\n  Generating variants for: ${audiencesToRun.join(", ")}`);
  console.log(`  Output directory: ${OUTPUT_DIR}/`);

  // Generate variants
  console.log(`\n[2/4] Calling Claude API...`);
  const results = {};

  for (const audienceKey of audiencesToRun) {
    const profile = AUDIENCE_PROFILES[audienceKey];
    console.log(`\n  → Adapting for ${profile.label}...`);

    const prompt = buildAdaptationPrompt(content, audienceKey);

    try {
      const adapted = await claudeComplete({
        system: `You are an expert instructional designer specialising in technical developer education. 
You adapt training materials for different audience levels with surgical precision — 
changing exactly what needs to change for the audience, and preserving everything else.
You never add commentary about your own output. You output only the adapted content.`,
        userMessage: prompt,
        maxTokens: 6000,
      });

      results[audienceKey] = adapted;
      console.log(`    Done. ${adapted.split(/\s+/).length} words generated.`);

    } catch (error) {
      console.error(`\n  Error generating ${audienceKey} variant: ${error.message}`);
      process.exit(1);
    }
  }

  // Validate outputs
  console.log(`\n[3/4] Validating outputs...`);
  let hasWarnings = false;

  for (const audienceKey of audiencesToRun) {
    const profile = AUDIENCE_PROFILES[audienceKey];
    const warnings = validateOutput(content, results[audienceKey], audienceKey);

    if (warnings.length > 0) {
      hasWarnings = true;
      console.log(`\n  ⚠  ${profile.label} variant warnings:`);
      warnings.forEach(w => console.log(`     - ${w}`));
    } else {
      console.log(`  ✓  ${profile.label} variant passed validation.`);
    }
  }

  if (hasWarnings) {
    console.log("\n  Review warnings before using these files.");
  }

  // Write files
  console.log(`\n[4/4] Writing files...`);

  for (const audienceKey of audiencesToRun) {
    const profile = AUDIENCE_PROFILES[audienceKey];
    const outputPath = writeOutput(results[audienceKey], OUTPUT_DIR, sectionName, audienceKey);
    console.log(`\n  ${profile.label}: ${outputPath}`);
    printDiffSummary(content, results[audienceKey], audienceKey);
  }

  // Usage reminder
  console.log("\n" + "=".repeat(60));
  console.log("  Done.");
  if (audiencesToRun.length === 2) {
    const baseName = sectionName;
    console.log(`\n  Files written:`);
    console.log(`    ${OUTPUT_DIR}/${baseName}-beginners.md`);
    console.log(`    ${OUTPUT_DIR}/${baseName}-advanced.md`);
  }
  console.log("\n  Review the diff summaries above before distributing.");
  console.log("  Key things to check:");
  console.log("    - Beginners: are analogies accurate? is reassurance appropriate?");
  console.log("    - Advanced: are edge cases technically correct?");
  console.log("    - Both: does all code still run correctly?");
  console.log("=".repeat(60));
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exit(1);
});