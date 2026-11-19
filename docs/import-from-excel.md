# Import from Excel (via Claude → JSON)

Materiel can import a **versioned JSON** file from **Settings → Import data → Import JSON file…**.

Excel is not read directly. Use Claude (or any AI) to turn a spreadsheet into Materiel JSON, then import that file in the app.

## Why JSON (and the chassis workaround)

Builds require **Action + Barrel + Chassis** (bolt) or equivalent core slots. Shooting logs attach to **builds**, not bare parts.

If your sheet only has **actions and barrels**:

1. Claude emits `parts` for those rows.
2. Claude emits explicit `builds` pairing each action with its barrel (preferred), **or** sets `options.autoPairBuilds: true`.
3. On import, Materiel creates a shared **placeholder Chassis** (`chassis-import-placeholder`) so builds can exist and logs can be attached.
4. Later, edit each build in the app and swap in a real chassis.

Missing action serials become `IMPORT-{id}`. Missing barrel gunsmith defaults to `Imported`. Missing barrel names are synthesized from manufacturer + model/caliber.

## Claude prompt (paste with your Excel attached)

```text
You are converting a firearms spreadsheet into Materiel import JSON.

Goal: produce ONE valid JSON document I can save as materiel-import.json and import in Materiel → Settings → Import data.

Rules:
1. Output ONLY JSON (no markdown fences, no commentary).
2. Use schema version 1 exactly as below.
3. Discover columns for actions and barrels (manufacturer, model, serial, cartridge/caliber, barrel name, gunsmith, round counts, notes, etc.). Map sensibly; do not invent match scores.
4. Prefer explicit `builds` that pair each action with the barrel it belongs with (use sheet columns like rifle name / build / pairing if present). If pairing is ambiguous, set "options": { "autoPairBuilds": true, "createPlaceholderChassis": true } and still emit parts; omit builds.
5. If the sheet has session/round history tied to a rifle, emit `logs` with buildId (or actionId+barrelId), date (YYYY-MM-DD), location, roundsFired, sessionType Practice|Match.
6. Give every part a stable string `id` (slug ok, e.g. act-1, bar-1). Builds may use ids like build-1.
7. Default platform is bolt_action unless the sheet clearly indicates AR or pistol.
8. Do not include chassis parts unless the sheet has them — Materiel will create a placeholder chassis for builds.

JSON shape:
{
  "version": 1,
  "options": {
    "createPlaceholderChassis": true,
    "autoPairBuilds": false,
    "defaultPlatform": "bolt_action"
  },
  "parts": [
    {
      "id": "act-1",
      "type": "Action",
      "manufacturer": "Impact Precision",
      "model": "737R",
      "serialNumber": "ABC123",
      "notes": null
    },
    {
      "id": "bar-1",
      "type": "Barrel",
      "manufacturer": "Proof Research",
      "name": "Proof 26 #1",
      "caliber": "6.5 Creedmoor",
      "gunsmith": "S&S",
      "totalRoundCount": 1200
    }
  ],
  "builds": [
    {
      "id": "build-1",
      "name": "Match 6.5",
      "platform": "bolt_action",
      "actionId": "act-1",
      "barrelId": "bar-1"
    }
  ],
  "logs": [
    {
      "buildId": "build-1",
      "date": "2026-10-15",
      "location": "Local range",
      "roundsFired": 40,
      "sessionType": "Practice"
    }
  ]
}

Convert the attached Excel now.
```

## After import

1. Open **Builds** — confirm imported builds (notes may mention placeholder furniture).
2. Replace placeholder chassis/upper when you have real stock.
3. Open **Logs** — confirm session history landed on the right builds.
4. Keep the JSON file as a backup of what you imported.

## Schema reference

See `src/shared/import.ts` for TypeScript types (`MaterielImportDocument`).
