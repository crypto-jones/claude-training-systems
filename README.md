# Claude Training Systems

AI-augmented tools for maintaining Claude API training content at scale.

Built to enable facilitators to deliver consistent, high-quality Claude 
API workshops without direct oversight from a central education team.

## What This Does

Three scripts that demonstrate AI-augmented content maintenance workflows:

**`analyze-feedback.js`** — Reads trainer session feedback (CSV), sends 
it to Claude API, and generates a structured markdown report with pattern 
analysis, content improvement recommendations, and priority action items. 
Designed to replace manual feedback review with an automated weekly insight loop.

**`adapt-content.js`** — Takes any section of a facilitator guide and 
generates audience-specific variants (beginner/advanced) using Claude API. 
Enables one source of truth to serve multiple audiences without manual rewriting.

**`check-versions.js`** — Reads trainer version records and flags who is 
running outdated content. Generates notification messages for out-of-date 
trainers. Enforces version compliance across a distributed trainer network.

## Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com))

### Setup
```bash
git clone https://github.com/YOURUSERNAME/claude-training-systems
cd claude-training-systems
npm install
cp .env.example .env
# Add your Anthropic API key to .env
```

### Run the feedback analyzer
```bash
npm run analyze
# or with custom paths:
node scripts/analyze-feedback.js \
  --csv sample-data/feedback.csv \
  --meta sample-data/feedback_meta.json \
  --output output/feedback-report.md
```

### Run the content adapter
```bash
npm run adapt
```

### Run the version checker
```bash
npm run check-versions
```

## Sample Data

The `sample-data/` folder contains realistic sample files so you can 
run all three scripts immediately without any setup beyond an API key.

## Project Structure
```
claude-training-systems/
├── scripts/
│   ├── analyze-feedback.js     # Feedback pattern analyzer
│   ├── adapt-content.js        # Audience variant generator  
│   └── check-versions.js       # Version compliance checker
├── sample-data/
│   ├── feedback.csv            # Sample trainer session feedback
│   ├── feedback_meta.json      # Guide version metadata
│   ├── trainer-versions.json   # Sample trainer version records
│   └── content-sample.md       # Sample facilitator guide section
└── output/                     # Generated reports (gitignored)
```

## Context

A train-the-trainer program for Claude API tool use. The facilitator 
guide these scripts support enables champions and partner trainers to 
run consistent 60-minute developer workshops independently.

The feedback analyzer runs weekly. The content adapter runs when the 
guide is updated. The version checker runs before each trainer cohort.