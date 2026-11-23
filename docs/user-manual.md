# Materiel user manual

Local-first desktop **firearms tracker**: parts inventory, complete builds, session logs, ammo & reloading, and maintenance alerts. Data stays encrypted on your machine.

**Pricing:** Free and unlimited — no license key.  
**Install:** [Install docs](./install.md) · [Latest release](https://github.com/davidcantu/materiel/releases/latest)

---

## First launch

1. Open Materiel.
2. Enter your **email** and continue. No password — email is your username for this local install.
3. **Set up Materiel** asks what to track:
   - Firearm types: **Bolt Action**, **AR-Pattern**, **Pistol** (keep at least one)
   - Track ammo use and inventory
   - Track load details (reloaders)
   - Track inventory and build values
4. You land on the main app. Change any of these later in **Settings → Tracking preferences**.

Unused sections stay hidden until you turn them back on. The **Ammo** nav item appears if ammo and/or loads tracking is on.

---

## Navigation

| Nav | Purpose |
| --- | --- |
| **Dashboard** | Rounds, systems, inventory KPIs; activity chart; placement trends; maintenance alerts |
| **Inventory** | Parts by platform and category |
| **Builds** | Complete firearms (custom or factory) |
| **Logs** | Practice and match sessions |
| **AARs** | After-Action Reviews, PPEWS Trends, AI Coach |
| **Ammo** | Ammo lots + **Load data** sub-tab (when enabled) |
| **Settings** | Profile, updates, theme, tracking prefs, AI API, milestones, import / export |

There is no separate Loads or Maintenance page — loads live under Ammo; maintenance is on build cards, dashboard alerts, and after logging when due.

---

## Inventory & platforms

**Inventory** tracks components. Part types depend on platform:

| Platform | Part types |
| --- | --- |
| Bolt Action | Action, Barrel, Chassis, Optic, Laser/IR, Muzzle Device, Trigger, Misc |
| AR-Pattern | Lower, Upper, Barrel, Laser/IR, Weapon Light, Muzzle Device, Trigger, Misc |
| Pistol | Pistol, Optic, Laser/IR, Weapon Light, Muzzle Device, Trigger, Misc |

**Tips**

- Identify parts by manufacturer + model (and unique id). Only **barrels** use a Name field (for round-count tracking).
- **Wear status** (In Stock / In Use / Sold / Retired) applies to **Barrel** and **Trigger**.
- Muzzle devices: pick **Suppressor** or **Brake**. Suppressors require a serial; brakes do not.
- Serial is required for Action, Lower, Pistol (and suppressor); optional for optics.
- Detail actions include Edit, Delete, **Mark as Sold** (optional sold-to note), Return to stock, Retire, and **Reset maintenance**.
- Manufacturer fields offer Cap Case brand suggestions (typeahead) for common makers — you can still type any name.

Filters: search, platform, category, wear status. Default view shows In Stock + In Use.

---

## Builds

**Builds** are complete systems (custom or factory).

1. **New Build** → choose platform and **Custom Build** or **Factory Firearm**.
2. Required: build name. Custom builds pick core parts from inventory (bolt optics required); factory builds enter manufacturer / model / cartridge.
3. Optional: landscape **build photo** (crop/zoom), accessories (trigger/misc), notes, maintenance intervals.
4. Cards show the photo first, then slots, barrel rounds, maintenance %, and value (if tracking).

Deleting a build returns assigned parts to In Stock. Use **Maintenance** on a card to see wear and reset intervals.

---

## Logs

**Logs** records range days.

1. **Log Session** → pick firearm system, ammo lot (or manual cartridge), date, rounds, location.
2. Optional: average velocity, notes.
3. Session type **Practice** or **Match**. Match adds **Place** and **% of Winner** (three decimal places).
4. **Review Session** → confirm → save.

List filters: search, system, Practice/Match, time window. Rows paginate **10** at a time with **See More**.

Dashboard shows placement and % trends (windows 10 / 20 / 50 / All) and optional ammo-rounds KPI when ammo tracking is on. Locations and last-used system/ammo sticky-default for faster entry.

After you save a **Match**, Materiel offers to write an **After-Action Review** (AAR). Practice sessions prompt only when **Settings → Prompt for an AAR after Practice sessions** is on. Each log row also has **Create AAR** / **View AAR**.

---

## AARs, PPEWS & AI Coach

**AARs** capture Match (or Practice) after-action notes with **PPEWS** point attribution (Preparation, Process, Elevation, Wind, Stability, Other).

1. Open **AARs** → **New AAR**, or create from a log.
2. Fill **Match info** (name, start date, level required to complete). Narratives are optional.
3. Enter PPEWS points dropped (0 is fine). Soft warning if totals disagree with score vs possible.
4. Optional **COF**: attach JPEG/PNG stage briefs; **Extract with AI** suggests stages — **confirm before use**. HEIC/PDF soft-fail for now.
5. **Mark complete**, **Copy Markdown**, or review **Trends** (offline aggregations) and **AI Coach**.

**AI Coach** (Settings → AI API for BYOK keys): Preview local stats, then Send. Analyses save in the encrypted DB; API keys stay in OS secure storage and are **not** backed up. See [ai-coach.md](./ai-coach.md).

---

## Ammo & loads

Under **Ammo** (when enabled):

### Inventory tab

- Add **Factory** or **Handload** lots.
- Required: **Cartridge**, **Quantity**, **Date made/purchased**.
- Optional: lot number, factory manufacturer, link to a load recipe, component details, notes.
- No separate Case or Name/Description fields — the lot name is generated for you.
- **Move to practice** is available on non-practice lots.

### Load data tab

- Reloading recipes only (charge, COAL, components, optional velocity/SD/ES).
- **Make Ammo** opens Add Ammo prefilled as a handload linked to that recipe — enter quantity and save.

Turn loads or ammo off in Settings if you do not need them.

---

## Maintenance

Maintenance is interval-based on parts that support it (e.g. barrels, actions, suppressors, pistols).

**Where you see it**

- Build card → **Maintenance**
- Dashboard → **Maintenance Alerts**
- After a log, if something is due (≥ ~61%)
- Inventory detail → progress + **Reset maintenance**

**Reset maintenance** clears rounds-since-cleaning for that part.

---

## Settings & preferences

| Section | What you can do |
| --- | --- |
| **About** | Version and short product blurb |
| **Updates** | **Check for updates** against GitHub Releases (manual download — nothing auto-installs) |
| **Profile** | Email, name, location, profile photo |
| **Milestones** | Unlockable badges as you use the app |
| **Appearance** | Theme: System / Light / Dark |
| **Tracking preferences** | Firearm types + ammo / loads / value + AAR-after-Practice toggle |
| **AI API** | BYOK provider/key/model, Test connection, capabilities |
| **Import / Export** | **Export Excel** (multi-sheet backup) or **Import JSON** (see [import-from-excel.md](./import-from-excel.md)) |

Email remains your local identity. There is no license or activation screen.

---

## Photos

- **Profile photo** (Settings): square crop; stored locally.
- **Build photo** (build form): landscape 16:9; drag to position, zoom, apply crop. Cards can keep a display scale.

Images are resized for performance and stored in the encrypted local database.

---

## Backup (today)

Your database is **encrypted SQLite on this computer**. That is the primary data store.

**What exists today**

- Encrypted local DB (AES-256) with the key held via the OS credential store.
- On schema upgrades, Materiel can keep a local DB+key copy beside app data if migration needs recovery.
- Cloud backup **plumbing** (scheduler / Google Drive / OneDrive) exists for developers and future UI — there is **no Settings panel** yet to connect a cloud provider or restore from the cloud.

Until restore UX ships, treat this install’s local data as the source of truth. Prefer not deleting the app data folder if you reinstall. See developer notes in [backup.md](./backup.md) if you are configuring providers yourself.

---

## Updates

1. Settings → **Check for updates**, or accept the launch dialog when a newer release is found.
2. Open [GitHub Releases](https://github.com/davidcantu/materiel/releases/latest).
3. Download the installer for your OS ([install docs](./install.md)).
4. Quit Materiel, run the installer, relaunch.

Your local encrypted database stays on the machine across updates.

---

## Quick FAQ

**Is there a paid tier or license?** No — free and unlimited.  
**Do I need an account server?** No — email is local identity only.  
**Where are Loads?** Ammo → **Load data** tab.  
**Where is Maintenance?** Build cards, dashboard alerts, and after logs — not its own nav item.  
**Mac says the app is damaged?** Clear quarantine: see [macOS install](./install/mac.md).  
**Windows SmartScreen?** More info → Run anyway: see [Windows install](./install/windows.md).
