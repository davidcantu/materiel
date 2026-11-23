/** After-Action Review (AAR) + PPEWS shared types. */

export type AarStatus = 'draft' | 'complete'

export type AarMatchLevel = 'club' | 'regional' | 'national' | 'practice' | 'other'

export type PpewsCategory =
  | 'preparation'
  | 'process'
  | 'elevation'
  | 'wind'
  | 'stability'
  | 'other'

export const PPEWS_CATEGORIES: readonly PpewsCategory[] = [
  'preparation',
  'process',
  'elevation',
  'wind',
  'stability',
  'other'
] as const

export const AAR_MATCH_LEVELS: readonly AarMatchLevel[] = [
  'club',
  'regional',
  'national',
  'practice',
  'other'
] as const

export type PpewsEntry = {
  id: string
  aarId: string
  category: PpewsCategory
  pointsDropped: number
  rating: number | null
  notes: string | null
}

export type AarAttachment = {
  id: string
  aarId: string
  relativePath: string
  aiRelativePath: string | null
  contentHash: string | null
  mimeType: string
  pageIndex: number | null
  originalFilename: string | null
  sortOrder: number
  createdAt: string
}

export type AarStageTarget = {
  label?: string
  distance?: string | number | null
  notes?: string | null
}

export type AarStage = {
  id: string
  aarId: string
  attachmentId: string | null
  stageNumber: number | null
  stageName: string | null
  description: string | null
  targets: AarStageTarget[]
  roundCount: number | null
  parTimeSec: number | null
  handwrittenNotes: string | null
  confirmedAt: string | null
}

export type AarRecord = {
  id: string
  logEntryId: string | null
  barrelId: string | null
  status: AarStatus
  matchName: string | null
  matchDateStart: string | null
  matchDateEnd: string | null
  venue: string | null
  matchLevel: AarMatchLevel | null
  division: string | null
  score: number | null
  scorePossible: number | null
  placement: number | null
  fieldSize: number | null
  roundsFired: number | null
  mindset: string | null
  rifleSetup: string | null
  goals: string | null
  whatWentRight: string | null
  lessonsLearned: string | null
  trainingPlan: string | null
  finalThoughts: string | null
  createdAt: string
  updatedAt: string
  ppews: PpewsEntry[]
  attachments: AarAttachment[]
  stages: AarStage[]
}

export type AarListItem = {
  id: string
  status: AarStatus
  matchName: string | null
  matchDateStart: string | null
  matchLevel: AarMatchLevel | null
  venue: string | null
  placement: number | null
  logEntryId: string | null
  updatedAt: string
  totalPointsDropped: number
}

export type AarPatch = {
  logEntryId?: string | null
  barrelId?: string | null
  matchName?: string | null
  matchDateStart?: string | null
  matchDateEnd?: string | null
  venue?: string | null
  matchLevel?: AarMatchLevel | null
  division?: string | null
  score?: number | null
  scorePossible?: number | null
  placement?: number | null
  fieldSize?: number | null
  roundsFired?: number | null
  mindset?: string | null
  rifleSetup?: string | null
  goals?: string | null
  whatWentRight?: string | null
  lessonsLearned?: string | null
  trainingPlan?: string | null
  finalThoughts?: string | null
}

export type PpewsPatch = {
  category: PpewsCategory
  pointsDropped?: number
  rating?: number | null
  notes?: string | null
}

export type AarCompleteValidation = {
  ok: boolean
  missing: string[]
}

export type PpewsMismatchWarning = {
  warned: boolean
  message: string | null
  scoreDropped: number | null
  ppewsTotal: number
}

export type CreateAarInput = {
  logEntryId?: string | null
  barrelId?: string | null
  matchName?: string | null
  matchDateStart?: string | null
  venue?: string | null
  matchLevel?: AarMatchLevel | null
  placement?: number | null
  roundsFired?: number | null
  rifleSetup?: string | null
}

export type AarStageInput = {
  id?: string
  attachmentId?: string | null
  stageNumber?: number | null
  stageName?: string | null
  description?: string | null
  targets?: AarStageTarget[]
  roundCount?: number | null
  parTimeSec?: number | null
  handwrittenNotes?: string | null
  confirmed?: boolean
}

export type TrendsFilters = {
  fromDate?: string | null
  toDate?: string | null
  matchLevel?: AarMatchLevel | null
  barrelId?: string | null
}

export type TrendsCategoryPoint = {
  category: PpewsCategory
  totalPointsDropped: number
  aarCount: number
  avgRating: number | null
}

export type TrendsSeriesPoint = {
  date: string
  aarId: string
  matchName: string | null
  byCategory: Record<PpewsCategory, number>
  total: number
}

export type TrendsSummary = {
  aarCount: number
  categories: TrendsCategoryPoint[]
  series: TrendsSeriesPoint[]
  topLeak: PpewsCategory | null
  callout: string | null
}
