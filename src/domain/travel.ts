export type TravelMode = 'walking' | 'driving'
export type TravelTimeLimit = 10 | 20 | 'wide'

const METERS_PER_MINUTE: Record<TravelMode, number> = {
  walking: 4_000 / 60,
  driving: 24_000 / 60,
}

const WIDE_DISTANCE_LIMIT_METERS: Record<TravelMode, number> = {
  walking: 2_000,
  driving: 20_000,
}

export function getTravelDistanceLimitMeters(
  mode: TravelMode,
  timeLimit: TravelTimeLimit,
): number {
  if (timeLimit === 'wide') {
    return WIDE_DISTANCE_LIMIT_METERS[mode]
  }

  return METERS_PER_MINUTE[mode] * timeLimit
}

export function estimateTravelTimeMinutes(
  distanceMeters: number,
  mode: TravelMode,
): number {
  return Math.max(1, Math.ceil(distanceMeters / METERS_PER_MINUTE[mode]))
}
