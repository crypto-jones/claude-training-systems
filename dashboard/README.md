# Training Content Systems — Dashboard

A static dashboard for **version compliance**, **session feedback metrics**, and **health indicators** from the Claude API training content system. Built with Next.js 14, Tailwind CSS, and Recharts.

## What’s in the dashboard

- **KPI cards** — Version compliance %, exercise completion, closing energy, feedback submission rate, FAQ SLA
- **Compliance by urgency** — Trainer counts per notification tier (CRITICAL / HIGH / MEDIUM / OK)
- **Compliance by region** — % on latest version per region (target 90%)
- **Session feedback health** — Exercise 1/2 completion, closing energy, submission rate vs targets
- **Weekly trends** — Exercise completion and closing energy over time
- **Energy by phase** — Opening, exercises, closing (target ≥3.0)

## Run locally

From the repo root:

```bash
cd dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build for production (static export)

```bash
cd dashboard
npm install
npm run build
```

Output is in `out/`. Serve that folder with any static host.

## Deploy to GitHub Pages

1. **Build with base path**  
   The app is already configured so that in production it uses base path `/claude-training-systems`. So when you deploy to `https://<user>.github.io/claude-training-systems/`, the site works correctly.

2. **Deploy the `out` folder**  
   After `npm run build`, push the contents of `out/` to the `gh-pages` branch of the same repo (or use GitHub Actions to build and deploy).

   Example with `gh-pages` (from the `dashboard` directory):

   ```bash
   npm run build
   npx gh-pages -d out -r <your-repo-url>
   ```

   If the repo is `crypto-jones/claude-training-systems`, enable GitHub Pages in **Settings → Pages** with source **Deploy from a branch**, branch **gh-pages**, folder **/ (root)**. The dashboard will be at:

   **https://crypto-jones.github.io/claude-training-systems/**

3. **Optional: GitHub Actions**  
   You can add a workflow that runs `npm run build` in `dashboard/` and deploys `out/` to `gh-pages` on push to `main`.

## Data source

- **Development / demo:** The dashboard reads **sample JSON** from `public/data/`:
  - `version-compliance.json` — Compliance summary, by region, by urgency, trainer list
  - `feedback-metrics.json` — Session totals, exercise completion, closing energy, targets
  - `feedback-trends.json` — Weekly and by-version trends
  - `section-energy.json` — Energy by phase (opening / exercises / closing)
  - `faq-sla.json` — FAQ SLA adherence

- **Production:** The same filenames and JSON shapes are the **data contract**. Your scripts (`check-versions.js`, `analyze-feedback.js`, etc.) should write these JSON files into the same paths (e.g. in CI or a cron job). Rebuild and redeploy the dashboard so the new data is baked into the static export.

## Stack

- **Next.js 14** (App Router, static export)
- **Tailwind CSS**
- **Recharts** for charts
- **TypeScript**

## Project layout

```
dashboard/
├── public/
│   └── data/           # Sample JSON (replace in production with script output)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx    # Loads data, renders dashboard
│   │   └── globals.css
│   └── components/     # Chart and KPI components
├── next.config.js      # output: 'export', basePath for GitHub Pages
├── package.json
└── README.md
```
