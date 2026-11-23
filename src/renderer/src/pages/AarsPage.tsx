import { useCallback, useEffect, useState } from 'react'
import type { AarListItem } from '../../../shared/aar'
import {
  AAR_PAGE_DESCRIPTION,
  AAR_PAGE_TITLE,
  PPEWS_ATTRIBUTION
} from '../../../shared/aar-template'
import type {
  AiCoachAnalyzeResult,
  AiCoachPreviewPayload
} from '../../../shared/ai-coach'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'
import { AarFormPage } from './AarFormPage'
import { AarTrendsPanel } from './AarTrendsPanel'

type TabId = 'list' | 'trends' | 'coach'

type AarsPageProps = {
  initialAarId?: string | null
  onConsumedInitial?: () => void
}

export function AarsPage({
  initialAarId = null,
  onConsumedInitial
}: AarsPageProps): React.JSX.Element {
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('list')
  const [items, setItems] = useState<AarListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<AiCoachPreviewPayload | null>(null)
  const [analysis, setAnalysis] = useState<AiCoachAnalyzeResult | null>(null)
  const [coachBusy, setCoachBusy] = useState(false)
  const [coachScope, setCoachScope] = useState<{
    matchLevel: import('../../../shared/aar').AarMatchLevel | null
  }>({ matchLevel: null })

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await window.api.listAars()
      setItems(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AARs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (initialAarId) {
      setEditingId(initialAarId)
      onConsumedInitial?.()
    }
  }, [initialAarId, onConsumedInitial])

  async function handleNew(): Promise<void> {
    try {
      const aar = await window.api.createAar({})
      setEditingId(aar.id)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create AAR')
    }
  }

  async function handleDelete(item: AarListItem): Promise<void> {
    if (!window.confirm(`Delete AAR “${item.matchName ?? item.id}”?`)) return
    try {
      await window.api.deleteAar(item.id)
      toast.success('AAR deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function runCoach(send: boolean): Promise<void> {
    setCoachBusy(true)
    setAnalysis(null)
    try {
      const result = await window.api.analyzeWithAiCoach({
        send,
        scope: {
          filters: {
            matchLevel: coachScope.matchLevel
          }
        }
      })
      if (!result.ok) {
        toast.error(result.error)
        if (result.preview) setPreview(result.preview)
        return
      }
      setPreview(result.preview)
      setAnalysis(result)
      if (send && result.analysis) {
        toast.success('Analysis saved.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI Coach failed')
    } finally {
      setCoachBusy(false)
    }
  }

  if (editingId) {
    return (
      <AarFormPage
        aarId={editingId}
        onBack={() => {
          setEditingId(null)
          void load()
        }}
      />
    )
  }

  return (
    <div className="page">
      <PageHeader
        title={AAR_PAGE_TITLE}
        description={AAR_PAGE_DESCRIPTION}
        actions={
          <button type="button" className="btn-primary btn-with-icon" onClick={() => void handleNew()}>
            <Icon name="add" size={16} />
            New AAR
          </button>
        }
      />

      <p className="muted">{PPEWS_ATTRIBUTION.short}</p>

      <div className="chip-row aar-tabs" role="tablist" aria-label="AAR views">
        {(
          [
            { id: 'list', label: 'AARs' },
            { id: 'trends', label: 'Trends' },
            { id: 'coach', label: 'AI Coach' }
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <PageFeedback
        loading={loading}
        loadingLabel="Loading AARs…"
        error={error}
        onRetry={() => void load()}
      />

      {tab === 'list' && !loading ? (
        items.length === 0 ? (
          <EmptyState
            icon="logs"
            title="No AARs yet"
            description="Log a Match (or Practice with the Settings toggle) and write an After-Action Review with PPEWS."
            actionLabel="New AAR"
            onAction={() => void handleNew()}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Date</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>PPEWS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-title">{item.matchName ?? 'Untitled AAR'}</div>
                      <div className="cell-sub">{item.venue ?? '—'}</div>
                    </td>
                    <td>{item.matchDateStart ?? '—'}</td>
                    <td>{item.matchLevel ?? '—'}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>{item.status}</span>
                    </td>
                    <td>{item.totalPointsDropped}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => setEditingId(item.id)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void handleDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {tab === 'trends' ? (
        <AarTrendsPanel
          onAnalyze={(filters) => {
            setCoachScope(filters)
            setTab('coach')
            void runCoach(false)
          }}
        />
      ) : null}

      {tab === 'coach' ? (
        <section className="aar-coach-panel">
          <h2>AI Coach</h2>
          <p className="muted">
            Uses your BYOK key from Settings. Preview the local stats payload, then send. Analyses
            are saved in the encrypted database (keys are not).
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="btn-ghost"
              disabled={coachBusy}
              onClick={() => void runCoach(false)}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={coachBusy}
              onClick={() => void runCoach(true)}
            >
              {coachBusy ? 'Working…' : 'Send analysis'}
            </button>
          </div>

          {preview ? (
            <div className="aar-coach-preview">
              <h3>Preview</h3>
              <p className="muted">
                {preview.provider} / {preview.model} · {preview.aarCount} AAR
                {preview.aarCount === 1 ? '' : 's'} · ~{preview.estimatedInputChars} chars
              </p>
              <ul>
                {preview.localStats.categories.map((c) => (
                  <li key={c.category}>
                    {c.category}: {c.totalPointsDropped}
                  </li>
                ))}
              </ul>
              <pre className="aar-prompt-preview">{preview.promptPreview}</pre>
            </div>
          ) : null}

          {analysis?.ok && analysis.analysis ? (
            <div className="aar-coach-result">
              <h3>Result</h3>
              <p>{analysis.analysis.summary}</p>
              {analysis.analysis.strengths.length > 0 ? (
                <>
                  <h4>Strengths</h4>
                  <ul>
                    {analysis.analysis.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {analysis.analysis.focusAreas.length > 0 ? (
                <>
                  <h4>Focus</h4>
                  <ul>
                    {analysis.analysis.focusAreas.map((f, i) => (
                      <li key={`${f.category}-${i}`}>
                        <strong>{f.category}</strong>: {f.summary}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {analysis.analysis.drills.length > 0 ? (
                <>
                  <h4>Drills</h4>
                  <ul>
                    {analysis.analysis.drills.map((d) => (
                      <li key={d.title}>
                        <strong>{d.title}</strong> — {d.description}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
