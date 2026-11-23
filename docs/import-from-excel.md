# Import / Export (Excel + JSON)

## Export to Excel

**Settings → Import / Export → Export Excel…** writes a `.xlsx` workbook with tabs:

| Sheet | Contents |
| --- | --- |
| **Summary** | Brand-styled dashboard: lifetime rounds, this year, builds, inventory; yearly bar graphic; top barrels |
| **Inventory** | All parts (filterable header row) |
| **Builds** | Complete systems |
| **Logs** | Session history (includes Year column) |
| **Round Counts** | Lifetime rounds by tracked part + yearly totals from logs |
| **Ammo** | On-hand ammo lots |

Lifetime / yearly round totals on Summary and Round Counts are calculated from **shooting logs**. Part `totalRoundCount` values are also listed for wear components.

## Import from Excel (native)

**Settings → Import / Export** supports:

1. **Download sample Excel…** — filled workbook with an Instructions tab plus sample Inventory / Builds / Logs / Ammo rows (same headers as export).
2. **Import Excel…** — pick a `.xlsx` (sample, edited sample, Google Sheets download, or a Materiel export).

Import rules:

- Headers on Inventory / Builds / Logs / Ammo must match export column names.
- Part IDs on Inventory must match Action/Primary, Barrel, Chassis/Furniture, Optic, and Suppressor cells on Builds.
- Log **Build ID** should match Builds **ID**.
- Existing part / build / ammo IDs are **reused**; new rows are created.
- **Summary** and **Round Counts** sheets are ignored (derived / display-only).
- Bolt builds without Chassis get a shared placeholder chassis (same as JSON import).

## JSON import (still available)

IPC `import:pick-json-file` / `import:from-json` still accept **MaterielImportDocument** v1 for automation and the Claude conversion path below. The Settings UI focuses on Excel.

## Why builds need furniture

Builds require **Action + Barrel + Chassis** (bolt) or equivalent core slots. Shooting logs attach to **builds**, not bare parts. Missing furniture can use the placeholder chassis; swap a real chassis later in the app.

## Claude prompt (optional: nonstandard sheets → JSON)

If your spreadsheet does **not** match Materiel headers, convert with Claude then import JSON via IPC/tools:

```text
You are converting a firearms spreadsheet into Materiel import JSON.

Goal: produce ONE valid JSON document I can save as materiel-import.json and import in Materiel.

Rules:
1. Output ONLY JSON (no markdown fences, no commentary).
2. Use schema version 1.
3. Prefer explicit builds pairing each action with its barrel.
4. If pairing is ambiguous, set "options": { "autoPairBuilds": true, "createPlaceholderChassis": true }.
5. Emit logs with buildId (or actionId+barrelId), date (YYYY-MM-DD), location, roundsFired, sessionType Practice|Match.
6. Give every part a stable string id.
7. Default platform is bolt_action unless the sheet clearly indicates AR or pistol.
```

See `src/shared/import.ts` for the full TypeScript shape (parts, builds, logs, ammo).
