/**
 * AAR section help, examples, and PPEWS attribution — single edit point.
 * Competition in product copy = Match (sessionType) in the app/DB.
 */

import type { PpewsCategory } from './aar'

export const AAR_NAV_LABEL = 'AARs'

export const AAR_PAGE_TITLE = 'After-Action Reviews'
export const AAR_PAGE_DESCRIPTION =
  'Capture Match or Practice AARs with PPEWS scoring, then review Trends and ask the AI Coach.'

export const AAR_PROMPT_TITLE = 'Write an After-Action Review?'
export const AAR_PROMPT_BODY_MATCH =
  'You just logged a Match. Capture what happened while it’s fresh — Match info, PPEWS points, and notes.'
export const AAR_PROMPT_BODY_PRACTICE =
  'You just logged Practice. Want to capture an AAR while the session is fresh?'
export const AAR_PROMPT_YES = 'Yes, write AAR'
export const AAR_PROMPT_LATER = 'Not now'

export const AAR_SETTING_PROMPT_ON_PRACTICE_LABEL =
  'Prompt for an AAR after Practice sessions'
export const AAR_SETTING_PROMPT_ON_PRACTICE_HELP =
  'Match sessions always offer an AAR after save. Turn this on to also prompt after Practice logs.'

export const PPEWS_ATTRIBUTION = {
  title: 'PPEWS',
  short:
    'PPEWS groups points dropped into Preparation, Process, Elevation, Wind, Stability, and Other.',
  detail:
    'PPEWS is a practical scoring lens for precision / PRS-style Matches: attribute dropped points to the skill family that caused them so Trends show where you leak points over time. Ratings (1–5) are optional self-scores for that category on this AAR.'
}

export const PPEWS_CATEGORY_LABELS: Record<PpewsCategory, string> = {
  preparation: 'Preparation',
  process: 'Process',
  elevation: 'Elevation',
  wind: 'Wind',
  stability: 'Stability',
  other: 'Other'
}

export const PPEWS_CATEGORY_HELP: Record<PpewsCategory, string> = {
  preparation:
    'Gear, zero, dope, packing, sleep, nutrition, stage planning, and anything decided before the shot clock.',
  process:
    'Shot process execution: position, natural point of aim, trigger, follow-through, transitions, and stage flow.',
  elevation:
    'Vertical misses from range estimation, dope, density altitude, or incorrect elevation holds.',
  wind: 'Horizontal misses from wind calls, mirage reading, or hold / dial mistakes.',
  stability:
    'Platform and body stability: bipod load, rear bag, pulse, unsupported positions, and wobble.',
  other: 'Anything that doesn’t fit cleanly — props, RO calls, ammo, malfunctions, or luck.'
}

export const PPEWS_CATEGORY_EXAMPLES: Record<PpewsCategory, string> = {
  preparation: 'Example: showed up with yesterday’s dope; cold-bore plan skipped.',
  process: 'Example: broke position early; rushed first round; forgot par time.',
  elevation: 'Example: used 400 yd dope on a 460 yd target.',
  wind: 'Example: full-value call when it was a half; ignored a switch mid-string.',
  stability: 'Example: bipod skate on gravel; pulse spiked on unsupported.',
  other: 'Example: prop failure; ammo flyer; stage brief change.'
}

export const AAR_SECTION_HELP = {
  matchInfo: {
    title: 'Match info',
    help: 'Name, dates, venue, level, division, score, placement, field size, and rounds. Competition in Materiel means a Match session.',
    example: 'Example: Club PRS — Oak Ridge, Regional, Open, 78/100, 4th of 42.'
  },
  mindset: {
    title: 'Mindset',
    help: 'How you felt walking in and during the Match or Practice — pressure, focus, confidence.',
    example: 'Example: Calm on stage 1–3; rushed after a miss on stage 4.'
  },
  rifleSetup: {
    title: 'Rifle setup',
    help: 'Barrel and build notes. Prefills from known barrel fields (maker, name, caliber, twist, life, gunsmith). Add chamber/length freehand if you want.',
    example: 'Example: Bartlein 26″ 1:8 6.5 CM, MDT ACC, NF ATACR, Thunder Beast.'
  },
  goals: {
    title: 'Goals',
    help: 'What you wanted from this session before it started.',
    example: 'Example: Clean wind calls under 10 mph; finish top half.'
  },
  whatWentRight: {
    title: 'What went right',
    help: 'Protect wins so Trends and the Coach reinforce them.',
    example: 'Example: Stage 6 process felt automatic; rear bag work held.'
  },
  lessonsLearned: {
    title: 'Lessons learned',
    help: 'Concrete takeaways tied to PPEWS leaks when possible.',
    example: 'Example: Confirm density altitude before first relay.'
  },
  trainingPlan: {
    title: 'Training plan',
    help: 'Next practice block — drills, dry fire, live fire volume.',
    example: 'Example: 2× unsupported positional dry-fire; one wind-hold live session.'
  },
  finalThoughts: {
    title: 'Final thoughts',
    help: 'Anything else for future-you or the AI Coach.',
    example: 'Example: Sleep was short — discount mental errors on stage 8.'
  },
  cof: {
    title: 'Course of fire (COF)',
    help: 'Attach stage brief photos (JPEG/PNG). Optional AI extraction suggests stages — confirm before they are used.',
    example: 'Example: Photo of printed stage brief or handwritten stage card.'
  },
  ppews: {
    title: 'PPEWS points dropped',
    help: 'Enter points dropped per category (0 is fine). Soft warning if totals disagree with score vs possible.',
    example: 'Example: Wind 8, Process 4, Elevation 2 — total 14 of 22 dropped.'
  }
} as const

export const AAR_COMPLETE_HINT =
  'To mark complete: fill Match info (name, start date, level) and ensure all six PPEWS categories are present (points may be 0). Narratives are optional.'

export const AAR_TRENDS_CALLOUT_PREFIX = 'Biggest leak lately:'
