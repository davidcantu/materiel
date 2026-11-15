/** Local profile settings exposed to the renderer. */

export type ProfileInfo = {
  id: string
  firstName: string
  lastName: string
  email: string | null
  city: string
  state: string
  country: string
  competitionSeries: string[]
  profileImageUrl: string | null
  trackValue: boolean
  trackAmmo: boolean
  unlockPinSet: boolean
  createdAt: string
  updatedAt: string
}

export type ProfilePatch = {
  firstName?: string
  lastName?: string
  email?: string | null
  city?: string
  state?: string
  country?: string
  trackValue?: boolean
  trackAmmo?: boolean
}
