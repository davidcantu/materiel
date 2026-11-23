import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AAR_MATCH_LEVELS,
  PPEWS_CATEGORIES,
  type AarMatchLevel,
  type AarRecord,
  type AarStageInput,
  type PpewsCategory
} from '../../../shared/aar'
import {
  AAR_COMPLETE_HINT,
  AAR_SECTION_HELP,
  PPEWS_ATTRIBUTION,
  PPEWS_CATEGORY_EXAMPLES,
  PPEWS_CATEGORY_HELP,
  PPEWS_CATEGORY_LABELS
} from '../../../shared/aar-template'
import type { AiCofExtractionStage } from '../../../shared/ai-coach'
import { useToast } from '../components/toast-context'
import { PageHeader } from '../components/PageHeader'

type AarFormPageProps = {
  aarId: string
  onBack: () => void
}

type SectionId =
  | 'match'
  | 'ppews'
  | 'narratives'
  | 'cof'
  | 'review'

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'match', label: 'Match info' },
  { id: 'ppews', label: 'PPEWS' },
  { id: 'narratives', label: 'Notes' },
  { id: 'cof', label: 'COF' },
  { id: 'review', label: 'Review' }
]

function numOrNull(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function AarFormPage({ aarId, onBack }: AarFormPageProps): React.JSX.Element {
  const toast = useToast()
  const [aar, setAar] = useState<AarRecord | null>(null)
  const [section, setSection] = useState<SectionId>('match')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState<string | null>(null)
  const [pendingExtraction, setPendingExtraction] = useState<AiCofExtractionStage[] | null>(null)
  const [extractingId, setExtractingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const next = await window.api.getAar(aarId)
    setAar(next)
    if (next) {
      const check = await window.api.validateAar(next.id)
      setMismatch(check.mismatch.warned ? check.mismatch.message : null)
    }
  }, [aarId])

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load AAR')
    )
  }, [load])

  const ppewsByCat = useMemo(() => {
    const map = new Map<PpewsCategory, { points: string; rating: string; notes: string }>()
    for (const cat of PPEWS_CATEGORIES) {
      const row = aar?.ppews.find((p) => p.category === cat)
      map.set(cat, {
        points: String(row?.pointsDropped ?? 0),
        rating: row?.rating != null ? String(row.rating) : '',
        notes: row?.notes ?? ''
      })
    }
    return map
  }, [aar])

  async function savePatch(
    patch: Parameters<typeof window.api.updateAar>[1]
  ): Promise<AarRecord | null> {
    setBusy(true)
    setError(null)
    try {
      const next = await window.api.updateAar(aarId, patch)
      setAar(next)
      const check = await window.api.validateAar(next.id)
      setMismatch(check.mismatch.warned ? check.mismatch.message : null)
      return next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function savePpews(
    category: PpewsCategory,
    field: 'points' | 'rating' | 'notes',
    value: string
  ): Promise<void> {
    const current = ppewsByCat.get(category)!
    const points = field === 'points' ? Number(value || 0) : Number(current.points || 0)
    const rating =
      field === 'rating' ? (value.trim() ? Number(value) : null) : current.rating ? Number(current.rating) : null
    const notes = field === 'notes' ? value : current.notes
    setBusy(true)
    try {
      const next = await window.api.upsertAarPpews(aarId, [
        { category, pointsDropped: Number.isFinite(points) ? points : 0, rating, notes }
      ])
      setAar(next)
      const check = await window.api.validateAar(next.id)
      setMismatch(check.mismatch.warned ? check.mismatch.message : null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PPEWS save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete(): Promise<void> {
    setBusy(true)
    try {
      const next = await window.api.completeAar(aarId)
      setAar(next)
      toast.success('AAR marked complete.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not complete AAR')
    } finally {
      setBusy(false)
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const { markdown } = await window.api.exportAarMarkdown(aarId)
      await navigator.clipboard.writeText(markdown)
      toast.success('Markdown copied to clipboard.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  async function handlePickAttachments(): Promise<void> {
    setBusy(true)
    try {
      const result = await window.api.pickAarAttachments(aarId)
      await load()
      if (result.skipped.length) {
        toast.error(result.skipped.join(' · '))
      } else {
        toast.success('Attachments added.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Attach failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleExtract(attachmentId: string): Promise<void> {
    setExtractingId(attachmentId)
    try {
      const result = await window.api.extractCof({ aarId, attachmentId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setPendingExtraction(result.extraction.stages)
      toast.success('Extraction ready — confirm before use.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setExtractingId(null)
    }
  }

  async function handleConfirmStages(): Promise<void> {
    if (!pendingExtraction) return
    const stages: AarStageInput[] = pendingExtraction.map((s, index) => ({
      stageNumber: s.stageNumber ?? index + 1,
      stageName: s.stageName ?? null,
      description: s.description ?? null,
      targets: s.targets ?? [],
      roundCount: s.roundCount ?? null,
      parTimeSec: s.parTimeSec ?? null,
      handwrittenNotes: s.handwrittenNotes ?? null,
      confirmed: true
    }))
    setBusy(true)
    try {
      await window.api.confirmAarStages(aarId, stages)
      setPendingExtraction(null)
      await load()
      toast.success('Stages confirmed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Confirm failed')
    } finally {
      setBusy(false)
    }
  }

  if (!aar) {
    return (
      <div className="page">
        <PageHeader title="AAR" description="Loading…" />
        {error ? <p className="error-text">{error}</p> : <p className="muted">Loading AAR…</p>}
        <button type="button" className="btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="page aar-form-page">
      <PageHeader
        title={aar.matchName?.trim() || 'After-Action Review'}
        description={`${aar.status === 'complete' ? 'Complete' : 'Draft'} · ${AAR_COMPLETE_HINT}`}
        actions={
          <div className="row-actions">
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back
            </button>
            <button type="button" className="btn-ghost" onClick={() => void handleExport()}>
              Copy Markdown
            </button>
            {aar.status === 'draft' ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void handleComplete()}
              >
                Mark complete
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() =>
                  void window.api.reopenAar(aarId).then(setAar).catch((err) =>
                    toast.error(err instanceof Error ? err.message : 'Reopen failed')
                  )
                }
              >
                Reopen draft
              </button>
            )}
          </div>
        }
      />

      {error ? <p className="error-text">{error}</p> : null}
      {mismatch ? <p className="aar-soft-warning">{mismatch}</p> : null}

      <div className="aar-stepper" role="tablist" aria-label="AAR sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={`aar-step${section === item.id ? ' active' : ''}`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'match' ? (
        <section className="aar-section">
          <h2>{AAR_SECTION_HELP.matchInfo.title}</h2>
          <p className="muted">{AAR_SECTION_HELP.matchInfo.help}</p>
          <p className="muted aar-example">{AAR_SECTION_HELP.matchInfo.example}</p>
          <div className="form-grid">
            <label className="field field-span">
              <span className="field-label">Match name</span>
              <input
                defaultValue={aar.matchName ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ matchName: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">Start date</span>
              <input
                type="date"
                defaultValue={aar.matchDateStart ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ matchDateStart: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">End date</span>
              <input
                type="date"
                defaultValue={aar.matchDateEnd ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ matchDateEnd: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">Venue</span>
              <input
                defaultValue={aar.venue ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ venue: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">Level</span>
              <select
                defaultValue={aar.matchLevel ?? ''}
                disabled={busy}
                onChange={(e) =>
                  void savePatch({
                    matchLevel: (e.target.value || null) as AarMatchLevel | null
                  })
                }
              >
                <option value="">Select…</option>
                {AAR_MATCH_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Division</span>
              <input
                defaultValue={aar.division ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ division: e.target.value || null })}
              />
            </label>
            <label className="field">
              <span className="field-label">Score</span>
              <input
                defaultValue={aar.score != null ? String(aar.score) : ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ score: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Score possible</span>
              <input
                defaultValue={aar.scorePossible != null ? String(aar.scorePossible) : ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ scorePossible: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Placement</span>
              <input
                defaultValue={aar.placement != null ? String(aar.placement) : ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ placement: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Field size</span>
              <input
                defaultValue={aar.fieldSize != null ? String(aar.fieldSize) : ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ fieldSize: numOrNull(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Rounds fired</span>
              <input
                defaultValue={aar.roundsFired != null ? String(aar.roundsFired) : ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ roundsFired: numOrNull(e.target.value) })}
              />
            </label>
          </div>
        </section>
      ) : null}

      {section === 'ppews' ? (
        <section className="aar-section">
          <h2>{AAR_SECTION_HELP.ppews.title}</h2>
          <p className="muted">{PPEWS_ATTRIBUTION.detail}</p>
          <p className="muted">{AAR_SECTION_HELP.ppews.help}</p>
          <div className="aar-ppews-grid">
            {PPEWS_CATEGORIES.map((category) => {
              const row = ppewsByCat.get(category)!
              return (
                <article key={category} className="aar-ppews-card">
                  <h3>{PPEWS_CATEGORY_LABELS[category]}</h3>
                  <p className="muted">{PPEWS_CATEGORY_HELP[category]}</p>
                  <p className="muted aar-example">{PPEWS_CATEGORY_EXAMPLES[category]}</p>
                  <div className="form-grid">
                    <label className="field">
                      <span className="field-label">Points dropped</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={row.points}
                        disabled={busy}
                        onBlur={(e) => void savePpews(category, 'points', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Rating (1–5)</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        defaultValue={row.rating}
                        disabled={busy}
                        onBlur={(e) => void savePpews(category, 'rating', e.target.value)}
                      />
                    </label>
                    <label className="field field-span">
                      <span className="field-label">Notes</span>
                      <textarea
                        rows={2}
                        defaultValue={row.notes}
                        disabled={busy}
                        onBlur={(e) => void savePpews(category, 'notes', e.target.value)}
                      />
                    </label>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {section === 'narratives' ? (
        <section className="aar-section">
          {(
            [
              ['mindset', 'mindset'],
              ['rifleSetup', 'rifleSetup'],
              ['goals', 'goals'],
              ['whatWentRight', 'whatWentRight'],
              ['lessonsLearned', 'lessonsLearned'],
              ['trainingPlan', 'trainingPlan'],
              ['finalThoughts', 'finalThoughts']
            ] as const
          ).map(([helpKey, field]) => (
            <div key={field} className="aar-narrative-block">
              <h3>{AAR_SECTION_HELP[helpKey].title}</h3>
              <p className="muted">{AAR_SECTION_HELP[helpKey].help}</p>
              <p className="muted aar-example">{AAR_SECTION_HELP[helpKey].example}</p>
              <textarea
                rows={4}
                defaultValue={(aar[field] as string | null) ?? ''}
                disabled={busy}
                onBlur={(e) => void savePatch({ [field]: e.target.value || null })}
              />
            </div>
          ))}
        </section>
      ) : null}

      {section === 'cof' ? (
        <section className="aar-section">
          <h2>{AAR_SECTION_HELP.cof.title}</h2>
          <p className="muted">{AAR_SECTION_HELP.cof.help}</p>
          <p className="muted aar-example">{AAR_SECTION_HELP.cof.example}</p>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => void handlePickAttachments()}
          >
            Attach JPEG / PNG
          </button>
          <ul className="aar-attachment-list">
            {aar.attachments.map((att) => (
              <li key={att.id}>
                <span>{att.originalFilename ?? att.relativePath}</span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    disabled={extractingId === att.id}
                    onClick={() => void handleExtract(att.id)}
                  >
                    {extractingId === att.id ? 'Extracting…' : 'Extract with AI'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      void window.api.deleteAarAttachment(att.id).then(() => load())
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {pendingExtraction ? (
            <div className="aar-extraction-preview">
              <h3>Confirm extracted stages</h3>
              <p className="muted">Nothing is used in Trends/Coach until you confirm.</p>
              <ul>
                {pendingExtraction.map((stage, index) => (
                  <li key={index}>
                    Stage {stage.stageNumber ?? index + 1}: {stage.stageName ?? 'Untitled'} —{' '}
                    {stage.description ?? 'No description'}
                  </li>
                ))}
              </ul>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPendingExtraction(null)}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void handleConfirmStages()}
                >
                  Confirm stages
                </button>
              </div>
            </div>
          ) : null}

          {aar.stages.filter((s) => s.confirmedAt).length > 0 ? (
            <div className="aar-confirmed-stages">
              <h3>Confirmed stages</h3>
              <ul>
                {aar.stages
                  .filter((s) => s.confirmedAt)
                  .map((stage) => (
                    <li key={stage.id}>
                      Stage {stage.stageNumber ?? '?'}: {stage.stageName ?? stage.description}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {section === 'review' ? (
        <section className="aar-section">
          <h2>Review</h2>
          <dl className="aar-review-dl">
            <div>
              <dt>Status</dt>
              <dd>{aar.status}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{aar.matchName ?? '—'}</dd>
            </div>
            <div>
              <dt>PPEWS total</dt>
              <dd>{aar.ppews.reduce((s, p) => s + p.pointsDropped, 0)}</dd>
            </div>
            <div>
              <dt>Attachments</dt>
              <dd>{aar.attachments.length}</dd>
            </div>
            <div>
              <dt>Confirmed stages</dt>
              <dd>{aar.stages.filter((s) => s.confirmedAt).length}</dd>
            </div>
          </dl>
          <p className="muted">{AAR_COMPLETE_HINT}</p>
        </section>
      ) : null}
    </div>
  )
}
