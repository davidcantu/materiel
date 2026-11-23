import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AAR_MATCH_LEVELS,
  PPEWS_CATEGORIES,
  type AarMatchLevel,
  type TrendsSummary
} from '../../../shared/aar'
import { PPEWS_CATEGORY_LABELS } from '../../../shared/aar-template'
import { PageFeedback } from '../components/PageFeedback'

const SERIES_COLORS: Record<string, string> = {
  preparation: 'var(--ppews-preparation, #6b7c3a)',
  process: 'var(--ppews-process, #8a6d3b)',
  elevation: 'var(--ppews-elevation, #4a6fa5)',
  wind: 'var(--ppews-wind, #5a8f9c)',
  stability: 'var(--ppews-stability, #7a5a8a)',
  other: 'var(--ppews-other, #8a6a5a)'
}

type AarTrendsPanelProps = {
  onAnalyze?: (filters: { matchLevel: AarMatchLevel | null }) => void
}

export function AarTrendsPanel({ onAnalyze }: AarTrendsPanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<TrendsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matchLevel, setMatchLevel] = useState<AarMatchLevel | 'all'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.api.getAarTrends({
        matchLevel: matchLevel === 'all' ? null : matchLevel,
        fromDate: fromDate || null,
        toDate: toDate || null
      })
      setSummary(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends')
    } finally {
      setLoading(false)
    }
  }, [matchLevel, fromDate, toDate])

  useEffect(() => {
    void load()
  }, [load])

  const maxCat = useMemo(() => {
    if (!summary) return 1
    return Math.max(1, ...summary.categories.map((c) => c.totalPointsDropped))
  }, [summary])

  const maxSeries = useMemo(() => {
    if (!summary) return 1
    return Math.max(1, ...summary.series.map((s) => s.total))
  }, [summary])

  return (
    <div className="aar-trends">
      <div className="toolbar aar-trends-toolbar">
        <label className="filter-select">
          <span className="field-label">Level</span>
          <select
            value={matchLevel}
            onChange={(e) => setMatchLevel(e.target.value as AarMatchLevel | 'all')}
          >
            <option value="all">All levels</option>
            {AAR_MATCH_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <span className="field-label">From</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="filter-select">
          <span className="field-label">To</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        {onAnalyze ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              onAnalyze({ matchLevel: matchLevel === 'all' ? null : matchLevel })
            }
          >
            Analyze with AI Coach
          </button>
        ) : null}
      </div>

      <PageFeedback
        loading={loading}
        loadingLabel="Loading trends…"
        error={error}
        onRetry={() => void load()}
      />

      {!loading && summary ? (
        <>
          {summary.callout ? <p className="aar-trends-callout">{summary.callout}</p> : null}

          <section className="aar-trends-section">
            <h3>Points dropped by category</h3>
            <div className="trend-chart aar-ppews-bars" role="img" aria-label="PPEWS category totals">
              {summary.categories.map((cat) => (
                <div key={cat.category} className="trend-bar-col">
                  <div
                    className="trend-bar"
                    style={{
                      height: `${Math.max(4, (cat.totalPointsDropped / maxCat) * 120)}px`,
                      background: SERIES_COLORS[cat.category]
                    }}
                    title={`${PPEWS_CATEGORY_LABELS[cat.category]}: ${cat.totalPointsDropped}`}
                  />
                  <span className="trend-bar-label">{PPEWS_CATEGORY_LABELS[cat.category]}</span>
                  <span className="trend-bar-pct">{cat.totalPointsDropped}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="aar-trends-section">
            <h3>Per-AAR series</h3>
            {summary.series.length === 0 ? (
              <p className="muted">No complete AARs in this filter window.</p>
            ) : (
              <svg
                className="aar-series-svg"
                viewBox={`0 0 ${Math.max(320, summary.series.length * 48)} 160`}
                role="img"
                aria-label="PPEWS points over AARs"
              >
                {summary.series.map((point, index) => {
                  const x = 24 + index * 48
                  let y = 140
                  return (
                    <g key={point.aarId}>
                      {PPEWS_CATEGORIES.map((category) => {
                        const value = point.byCategory[category]
                        const h = (value / maxSeries) * 120
                        y -= h
                        return (
                          <rect
                            key={category}
                            x={x}
                            y={y}
                            width={28}
                            height={Math.max(0, h)}
                            fill={SERIES_COLORS[category]}
                          >
                            <title>
                              {point.matchName ?? point.date}: {PPEWS_CATEGORY_LABELS[category]}{' '}
                              {value}
                            </title>
                          </rect>
                        )
                      })}
                      <text x={x + 14} y={155} textAnchor="middle" className="aar-series-label">
                        {(point.date || '').slice(5) || '—'}
                      </text>
                    </g>
                  )
                })}
              </svg>
            )}
            <div className="aar-ppews-legend">
              {PPEWS_CATEGORIES.map((category) => (
                <span key={category} className="aar-ppews-legend-item">
                  <span
                    className="aar-ppews-swatch"
                    style={{ background: SERIES_COLORS[category] }}
                  />
                  {PPEWS_CATEGORY_LABELS[category]}
                </span>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
