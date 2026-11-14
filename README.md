Materiel
A web application for precision rifle competitors and enthusiasts to track modular firearm components, complete rifle builds, shooting sessions, ammunition, reloading loads, maintenance intervals, and community performance.

Overview
Materiel centralizes the lifecycle of precision rifle systems. Track individual components (actions, barrels, chassis, optics, muzzle devices) with round counts, cleaning intervals, and valuations. Assemble complete custom or factory builds. Log practice and match sessions with automatic propagation of round counts and ammunition deductions. Manage factory and handload inventories alongside detailed load development data. Monitor maintenance alerts, activity trends, logging streaks, and community rankings.

Features
Inventory — Component tracking with status, serial numbers, valuations, barrel life, and maintenance intervals
Complete Builds — Custom and factory rifle assemblies with photos, notes, and total system value
Shooting Logs — Session recording (rounds, velocity, location, practice/match) with automatic part and ammo updates
Ammo & Reloading — Factory/handload inventory, load recipes (velocity, SD, ES, COAL/CBTO), and one-click move to practice ammo
Dashboard — KPIs, 12-month activity chart, 14-day logging streak, and color-coded maintenance alerts
Community Stats — Percentile rankings, skill tiers, six unlockable milestones, and top-5 reloading component leaderboards
Admin Console — User roles and tiers, full or per-user backups/restores, automated backup policies, and platform analytics
Profile & Settings — Shooter details, competition series, MFA, value/ammo tracking toggles, and data export
Tech Stack
React 19 + TypeScript
Vite
Tailwind CSS
Recharts
Lucide React
Motion
Getting Started
Prerequisites: Node.js

npm install
Create a .env.local file and set GEMINI_API_KEY if using AI features.

npm run dev
Open http://localhost:3000.

Scripts
Command	Description
npm run dev	Start development server
npm run build	Production build
npm run preview	Preview production build
npm run lint	TypeScript check
Documentation
Full functional, domain, data, and UI/UX specification: SOFTWARE_SPEC.md
