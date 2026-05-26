# ?? Social Cricket Scorer

A Progressive Web App (PWA) for scoring social cricket matches — works on Android & iOS direct from the browser, no app store needed.

## Features
- ?? Ball-by-ball live scoring
- ?? Mobile-first PWA — install to home screen on Android & iOS
- ?? Tracks runs, wickets, extras (wides, no-balls, byes, leg-byes)
- ?? Full batting & bowling scorecards
- ?? Target/RRR display for second innings
- ?? Undo last ball
- ?? Auto-saves match state (resumes if browser closes)

## Tech Stack
| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| State | Zustand (with localStorage persistence) |
| Router | React Router v6 |
| Build | Vite 5 |
| PWA | vite-plugin-pwa |

## Getting Started

### Prerequisites
- Node.js 18+

### Install & run
`\ash
npm install
npm run dev
`\

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for production
`\ash
npm run build
npm run preview
`\

## Installing on Mobile (PWA)

**Android (Chrome):** Open the app URL ? tap the three-dot menu ? *Add to Home screen*

**iOS (Safari):** Open the app URL ? tap the Share button ? *Add to Home Screen*

## Project Structure
`\
src/
+-- types/cricket.ts       # TypeScript types
+-- utils/cricket.ts       # Score calculations
+-- store/matchStore.ts    # Zustand state + logic
+-- pages/
¦   +-- Home.tsx           # Home / resume match
¦   +-- MatchSetup.tsx     # Team & format setup
¦   +-- Toss.tsx           # Toss selection
¦   +-- Scoring.tsx        # Live scoring screen
¦   +-- InningsBreak.tsx   # Between innings summary
¦   +-- Result.tsx         # Final scorecard
+-- components/
    +-- PlayerSelector.tsx # Batsman / bowler picker
`\

## Scoring Screen

| Button | Action |
|--------|--------|
| **0–6** | Runs off bat |
| **W** | Wicket (prompts dismissal type) |
| **Wd** | Wide (adds 1 extra) |
| **Nb** | No ball (adds 1 extra, ball not counted) |
| **B** | Bye |
| **Lb** | Leg bye |
| **? Undo** | Remove last ball |
