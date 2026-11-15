# Materiel

Local-first Electron desktop app for precision rifle shooters: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup.

**Display name:** Materiel  
**Free tier:** 2 complete rifles (license key unlocks more)  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs Electron with Vite HMR. Uses `.env.development` (mock cloud backup, unlocked license mode).

## Build gates

| Script | Mode | Notes |
|--------|------|--------|
| `npm run dev` | development | Local app + mock backup provider |
| `npm run build:test` | test | Typecheck, Vite build (`--mode test`), electron-builder (no publish) |
| `npm run build:prod` | production | Typecheck, Vite build (`--mode production`), electron-builder for GitHub Releases packaging |

Platform helpers: `npm run build:mac`, `npm run build:win`, `npm run build:linux` (run on the matching OS or CI).

Packaging targets **`.dmg`** (mac) and **`.exe`** / NSIS (win) via `electron-builder.yml`, published through GitHub Releases when configured.

## Quality checks

```bash
npm run typecheck
npm run lint
```

## Project layout

```
src/
  main/           # Electron main process
    db/           # SQLite + better-sqlite3-multiple-ciphers (stub)
    backup/       # Drive / OneDrive / mock + hourly/quit hooks (stub)
    license/      # Free-tier rifle gate (stub)
  preload/        # Typed contextBridge
  renderer/       # React UI shell
```

Env templates: `.env.development`, `.env.test`, `.env.production`, and `.env.example` (no secrets).

## Follow-ups

- Encrypted SQLite schema + migrations
- Real Google Drive / OneDrive OAuth backup
- License key persistence + create-build gate
- Inventory, Builds, Logs, Ammo, Dashboard modules

## License

MIT — see [LICENSE](./LICENSE).
