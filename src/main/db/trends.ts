/**
 * Offline PPEWS aggregations for Trends (pure SQL/TS).
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import {
  AAR_TRENDS_CALLOUT_PREFIX,
  PPEWS_CATEGORY_LABELS
} from '../../shared/aar-template'
import {
  PPEWS_CATEGORIES,
  type PpewsCategory,
  type TrendsCategoryPoint,
  type TrendsFilters,
  type TrendsSeriesPoint,
  type TrendsSummary
} from '../../shared/aar'

type AggRow = {
  category: PpewsCategory
  total_points: number
  aar_count: number
  avg_rating: number | null
}

type SeriesRow = {
  aar_id: string
  match_date_start: string | null
  match_name: string | null
  category: PpewsCategory
  points_dropped: number
}

function emptyByCategory(): Record<PpewsCategory, number> {
  return {
    preparation: 0,
    process: 0,
    elevation: 0,
    wind: 0,
    stability: 0,
    other: 0
  }
}

export function getPpewsTrends(db: Database.Database, filters: TrendsFilters = {}): TrendsSummary {
  const where: string[] = [`a.status = 'complete'`]
  const params: Record<string, unknown> = {}

  if (filters.fromDate) {
    where.push(`a.match_date_start >= @fromDate`)
    params.fromDate = filters.fromDate
  }
  if (filters.toDate) {
    where.push(`a.match_date_start <= @toDate`)
    params.toDate = filters.toDate
  }
  if (filters.matchLevel) {
    where.push(`a.match_level = @matchLevel`)
    params.matchLevel = filters.matchLevel
  }
  if (filters.barrelId) {
    where.push(`a.barrel_id = @barrelId`)
    params.barrelId = filters.barrelId
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const aarCount = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM aar a ${whereSql}`)
      .get(params) as { c: number }
  ).c

  const aggRows = db
    .prepare(
      `SELECT p.category AS category,
              COALESCE(SUM(p.points_dropped), 0) AS total_points,
              COUNT(DISTINCT a.id) AS aar_count,
              AVG(p.rating) AS avg_rating
       FROM aar a
       JOIN aar_ppews p ON p.aar_id = a.id
       ${whereSql}
       GROUP BY p.category`
    )
    .all(params) as AggRow[]

  const byCat = new Map(aggRows.map((r) => [r.category, r]))
  const categories: TrendsCategoryPoint[] = PPEWS_CATEGORIES.map((category) => {
    const row = byCat.get(category)
    return {
      category,
      totalPointsDropped: row ? Number(row.total_points) || 0 : 0,
      aarCount: row ? Number(row.aar_count) || 0 : 0,
      avgRating: row?.avg_rating == null ? null : Number(row.avg_rating)
    }
  })

  const seriesRows = db
    .prepare(
      `SELECT a.id AS aar_id,
              a.match_date_start AS match_date_start,
              a.match_name AS match_name,
              p.category AS category,
              p.points_dropped AS points_dropped
       FROM aar a
       JOIN aar_ppews p ON p.aar_id = a.id
       ${whereSql}
       ORDER BY COALESCE(a.match_date_start, a.updated_at) ASC, a.id ASC`
    )
    .all(params) as SeriesRow[]

  const seriesMap = new Map<string, TrendsSeriesPoint>()
  for (const row of seriesRows) {
    let point = seriesMap.get(row.aar_id)
    if (!point) {
      point = {
        date: row.match_date_start ?? '',
        aarId: row.aar_id,
        matchName: row.match_name,
        byCategory: emptyByCategory(),
        total: 0
      }
      seriesMap.set(row.aar_id, point)
    }
    point.byCategory[row.category] = Number(row.points_dropped) || 0
    point.total += Number(row.points_dropped) || 0
  }
  const series = [...seriesMap.values()]

  let topLeak: PpewsCategory | null = null
  let topPts = -1
  for (const cat of categories) {
    if (cat.totalPointsDropped > topPts) {
      topPts = cat.totalPointsDropped
      topLeak = cat.category
    }
  }
  if (topPts <= 0) topLeak = null

  const callout =
    topLeak && aarCount > 0
      ? `${AAR_TRENDS_CALLOUT_PREFIX} ${PPEWS_CATEGORY_LABELS[topLeak]} (${topPts} pts across ${aarCount} AAR${aarCount === 1 ? '' : 's'}).`
      : aarCount === 0
        ? 'Complete an AAR with PPEWS points to unlock Trends.'
        : null

  return { aarCount, categories, series, topLeak, callout }
}
