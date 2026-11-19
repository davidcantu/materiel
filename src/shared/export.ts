/** Excel export result for Settings → Export. */

export type MaterielExportResult =
  | { ok: true; path: string }
  | { ok: false; error: string }
