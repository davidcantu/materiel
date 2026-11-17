/**
 * Structured failure from openDatabase / migrate / init — never wipe the DB.
 */

export type DatabaseInitFailure = {
  /** Short user-facing summary */
  message: string
  /** Underlying error text (for Console / detail) */
  detail: string
  /** Live database path (untouched) */
  dbPath: string
  /** Timestamped backup directory, if one was created */
  backupDir: string | null
}

export class DatabaseInitError extends Error {
  readonly dbPath: string
  readonly backupDir: string | null
  readonly detail: string

  constructor(
    message: string,
    options: { dbPath: string; backupDir?: string | null; cause?: unknown }
  ) {
    const detail = formatUnknownError(options.cause ?? message)
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'DatabaseInitError'
    this.dbPath = options.dbPath
    this.backupDir = options.backupDir ?? null
    this.detail = detail
  }

  toFailure(): DatabaseInitFailure {
    return {
      message: this.message,
      detail: this.detail,
      dbPath: this.dbPath,
      backupDir: this.backupDir
    }
  }
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function toDatabaseInitFailure(
  error: unknown,
  fallback: { dbPath: string; backupDir?: string | null } = { dbPath: '' }
): DatabaseInitFailure {
  if (error instanceof DatabaseInitError) {
    return error.toFailure()
  }

  return {
    message: 'Materiel could not open or upgrade its local database.',
    detail: formatUnknownError(error),
    dbPath: fallback.dbPath,
    backupDir: fallback.backupDir ?? null
  }
}

/** Copy for the native dialog body (data preserved; how to find Console). */
export function buildDatabaseInitFailureDetail(failure: DatabaseInitFailure): string {
  const lines = [
    'Your data was not deleted.',
    '',
    `Database: ${failure.dbPath || '(unknown)'}`,
    failure.backupDir
      ? `Backup copy: ${failure.backupDir}`
      : 'Backup copy: none (no existing database file was found before upgrade).',
    '',
    `Error: ${failure.detail}`,
    '',
    'How to view logs:',
    '• macOS: open Console.app, select your Mac in the sidebar, search for “Materiel”.',
    '• Or quit and launch from Terminal:',
    '  /Applications/Materiel.app/Contents/MacOS/Materiel',
    '  then read the printed error output.'
  ]
  return lines.join('\n')
}

/** Minimal HTML shown in the BrowserWindow when main init fails (avoids blank hang). */
export function buildDatabaseInitFailureHtml(failure: DatabaseInitFailure): string {
  const esc = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const backupBlock = failure.backupDir
    ? `<p><strong>Backup copy</strong><br><code>${esc(failure.backupDir)}</code></p>`
    : `<p>No pre-upgrade backup was needed (or the database file was missing).</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Materiel — database error</title>
  <style>
    :root {
      --brand-od: #556B2F;
      --brand-od-deep: #4B5320;
      --sand: #C4B896;
      --danger: #8B3A3A;
      --bg: #1a1c16;
      --fg: #f2efe6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Source Sans 3", "Segoe UI", sans-serif;
      background:
        radial-gradient(ellipse at 20% 0%, rgba(85, 107, 47, 0.35), transparent 55%),
        linear-gradient(160deg, #12140f 0%, var(--bg) 45%, #22261c 100%);
      color: var(--fg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    main {
      max-width: 36rem;
      width: 100%;
    }
    .brand {
      font-family: "Black Ops One", "Arial Black", sans-serif;
      letter-spacing: 0.06em;
      font-size: 1.75rem;
      color: var(--sand);
      margin: 0 0 1.25rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.75rem;
      color: #f0d0d0;
    }
    p { line-height: 1.5; margin: 0 0 0.85rem; color: #d9d4c6; }
    code {
      display: inline-block;
      margin-top: 0.35rem;
      padding: 0.35rem 0.5rem;
      background: rgba(0, 0, 0, 0.35);
      border-left: 3px solid var(--brand-od);
      font-size: 0.85rem;
      word-break: break-all;
      color: var(--sand);
    }
    .note {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(196, 184, 150, 0.25);
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main>
    <p class="brand">MATERIEL</p>
    <h1>Could not open the local database</h1>
    <p>Your data was not deleted. Use the dialog to quit, then check Console logs or relaunch from Terminal if you need the full error.</p>
    <p><strong>Database</strong><br><code>${esc(failure.dbPath || '(unknown)')}</code></p>
    ${backupBlock}
    <p class="note"><strong>Detail</strong><br>${esc(failure.detail)}</p>
  </main>
</body>
</html>`
}
