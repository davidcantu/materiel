# Packaging smoke — Materiel

Results from a Linux CI-style packaging smoke on `main` (unsigned; `--publish never`).

| Field | Value |
| --- | --- |
| Date (UTC) | 2026-11-15 |
| Commit | `1e7075b078561bf8d5c843df3b4dce856ae290e3` |
| OS | Linux 6.12.113+ x86_64 |
| Node / npm | v22.23.4 / 10.9.9 |
| Electron | v44.11.3 |
| electron-builder | 26.18.0 |
| Overall | **PASS** (Linux AppImage + unpacked dir; headless launch with `MATERIEL_DB_KEY`) |

## Commands

```bash
npm ci
npm run typecheck
npm test
npm run build:test -- --linux AppImage --dir
# or: npm run build:test:linux
npm run smoke:linux
```

`smoke:linux` rebuilds the Linux test package, then launches the unpacked binary under `timeout` with CI-friendly Electron flags.

## Results

| Step | Result | Notes |
| --- | --- | --- |
| `npm ci` | PASS | Native module rebuilt for Electron |
| `npm run typecheck` | PASS | |
| `npm test` | 39 pass / 1 fail | `insertBackupLog + listRecentBackupLogs` status assertion; unrelated to packaging |
| `build:test` (Linux AppImage + `--dir`) | PASS | Artifacts under `dist/` |
| Unpacked binary launch | PASS | Exit 124 from `timeout` = process stayed alive; `[db] ready … keySource=env` |
| AppImage | PASS | Runnable with `--appimage-extract-and-run` when FUSE/extract path is available |
| macOS `.dmg` / Windows NSIS | BLOCKED on Linux | Expected — build those on matching OS runners |

## Artifacts (this smoke)

| Artifact | Path | Approx. size |
| --- | --- | --- |
| Unpacked Linux app | `dist/linux-unpacked/materiel` | ~219 MB |
| AppImage | `dist/Materiel-0.1.0.AppImage` | ~134 MB |

## Headless / CI notes

- **Display:** A real `DISPLAY` or `xvfb-run` helps; D-Bus “connection refused” noise is common and non-fatal here.
- **GPU:** Prefer `--disable-gpu --in-process-gpu` (see `scripts/smoke-packaged-linux.sh`) to avoid GPU-process FATAL exits in VMs.
- **DB key:** Without OS `safeStorage`, set `MATERIEL_DB_KEY` for smoke only. Without it, the binary may start then reject DB open with `No database key available…`.
- **No signed prod release** in this flow.

## Platform matrix

| Target | Configured in `electron-builder.yml` | Produced on Linux smoke |
| --- | --- | --- |
| Linux AppImage | Yes | Yes |
| Linux unpacked (`--dir`) | Via CLI | Yes |
| macOS DMG (universal) | Yes | No |
| Windows NSIS | Yes | No |
