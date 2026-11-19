# Materiel

Local-first Electron desktop **firearms tracker**: component inventory, complete builds, session logs, ammo/reloading, and maintenance — with optional encrypted cloud backup (developer / future UI).

**Display name:** Materiel  
**Pricing:** Free and unlimited  
**Stack:** Electron + React + TypeScript via [electron-vite](https://electron-vite.org/)

## Docs

| For | Link |
| --- | --- |
| **User manual** | [docs/user-manual.md](./docs/user-manual.md) |
| **Install / unsigned help** | [docs/install.md](./docs/install.md) · [macOS](./docs/install/mac.md) · [Windows](./docs/install/windows.md) · [Linux](./docs/install/linux.md) |
| **Docs index** | [docs/README.md](./docs/README.md) |

## Download

Get the latest build from **[GitHub Releases](https://github.com/davidcantu/materiel/releases/latest)**.

| OS | Download | Notes |
| --- | --- | --- |
| **macOS Apple Silicon** (M1/M2/M3…) | `Materiel-*-arm64.dmg` | Prefer DMG; matching `-arm64-mac.zip` also published |
| **macOS Intel** | `Materiel-*-x64.dmg` | Matching `-mac.zip` also published |
| **Windows** (x64) | `Materiel-*-setup.exe` | NSIS installer |
| **Linux** (x64) | `Materiel-*.AppImage` | Make executable, then run |

First launch: enter **email** (that is the username). Full walkthrough: [user manual](./docs/user-manual.md).

### macOS

Ad-hoc signed (no Developer ID). Gatekeeper / “damaged” / Open Anyway / `xattr` steps: **[docs/install/mac.md](./docs/install/mac.md)**.

### Windows

Unsigned NSIS. SmartScreen (**More info → Run anyway**): **[docs/install/windows.md](./docs/install/windows.md)**.

### Linux

AppImage chmod / FUSE fallback: **[docs/install/linux.md](./docs/install/linux.md)**.

## Prerequisites

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

```bash
npm install
```

## Mac install (from source)

```bash
git clone https://github.com/davidcantu/materiel.git
cd materiel
npm install
npm run build:mac
```

Open the `.dmg` under `dist/` and install. Prefer a [Release](https://github.com/davidcantu/materiel/releases) download when available — see [docs/install/mac.md](./docs/install/mac.md).

## Development

```bash
npm run dev
```

Runs Electron with Vite HMR. Uses `.env.development` (mock cloud backup, demo seed).

## Build gates

| Script                     | Mode        | Notes                                                                                       |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`              | development | Local app + mock backup provider                                                            |
| `npm run build:test`       | test        | Typecheck, Vite build (`--mode test`), electron-builder (no publish)                        |
| `npm run build:test:linux` | test        | Same as `build:test`, forced Linux AppImage + unpacked `--dir`                              |
| `npm run smoke:linux`      | test        | `build:test:linux` then brief headless launch of `dist/linux-unpacked/materiel`             |
| `npm run build:prod`       | production  | Typecheck, Vite build (`--mode production`), electron-builder for GitHub Releases packaging |

Platform helpers: `npm run build:mac`, `npm run build:win`, `npm run build:linux` (run on the matching OS or CI).

Packaging targets **AppImage** (linux), **`.dmg`** (mac), and **`.exe`** / NSIS (win) via `electron-builder.yml`, published through GitHub Releases when configured. Linux CI cannot produce mac/win installers — see [docs/packaging-smoke.md](./docs/packaging-smoke.md).

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
```

## Database

Encrypted SQLite (`sqlcipher` / AES-256) with forward migrations. Default key is stored via Electron `safeStorage`; see [docs/database.md](./docs/database.md).

Dev can seed demo data with `MAIN_VITE_SEED_DEMO=true` (already set in `.env.development`).

## Backup

Hourly (configurable) + on quit. Uploads the encrypted DB file. There is **no Settings UI** for cloud backup yet — see [user manual § Backup](./docs/user-manual.md#backup-today) and [docs/backup.md](./docs/backup.md).

- **Dev:** mock provider writes to `{userData}/mock-cloud/`
- **Test/Prod:** Google Drive or OneDrive via OAuth PKCE — see [docs/backup.md](./docs/backup.md)

Set `MAIN_VITE_GOOGLE_CLIENT_ID` / `MAIN_VITE_ONEDRIVE_CLIENT_ID` in the matching env file or CI secrets (never commit secrets). IPC: `getBackupSettings`, `setBackupSettings`, `runBackupNow`, `listBackupLogs`, `getBackupStatus`, `authenticateBackup`.

## Project layout

```
src/
  main/           # Electron main process
    db/           # Encrypted SQLite + migrations + §7 helpers
    backup/       # Drive / OneDrive / mock + hourly/quit scheduler
    systems/      # Complete-system create / list IPC
  preload/        # Typed contextBridge
  renderer/       # React UI shell
docs/
  README.md       # Docs index (user + developer)
  user-manual.md  # End-user guide
  install.md      # Download / unsigned overview
  install/        # macOS, Windows, Linux install help
  database.md     # Key supply, migrations, schema map
  backup.md       # OAuth setup + IPC
```

Env templates: `.env.development`, `.env.test`, `.env.production`, and `.env.example` (no secrets).

## Import / Export

- **Export Excel** from **Settings → Import / Export** — multi-sheet workbook (Summary, Inventory, Builds, Logs, Round Counts, Ammo) with yearly + lifetime rounds.
- **Import JSON** from the same Settings panel. For spreadsheets, use the Claude prompt in [docs/import-from-excel.md](./docs/import-from-excel.md) (action+barrel sheets get a placeholder chassis so builds/logs can import).

## Follow-ups

- Settings UI for backup provider / interval
- Restore-from-cloud UX
- Optional Apple Developer ID / notarization and Windows Authenticode signing (fewer Gatekeeper / SmartScreen prompts)

## License

MIT — see [LICENSE](./LICENSE).
