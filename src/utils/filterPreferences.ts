import {
  RESTAURANT_CATEGORIES,
  type CategoryFilter,
} from '../domain/restaurant'
import type { TravelMode, TravelTimeLimit } from '../domain/travel'

export interface FilterPreferences {
  category: CategoryFilter | null
  budget: number | null
  travelMode: TravelMode | null
  travelTimeLimit: TravelTimeLimit | null
}

const categories = new Set<string>(['전체', ...RESTAURANT_CATEGORIES])
const budgets = new Set([10_000, 15_000, 20_000])
const travelModes = new Set<TravelMode>(['walking', 'driving'])
const travelTimeLimits = new Set<TravelTimeLimit>([10, 20, 'wide'])

export function createEmptyFilterPreferences(): FilterPreferences {
  return {
    category: null,
    budget: null,
    travelMode: null,
    travelTimeLimit: null,
  }
}

export function serializeFilterPreferences(
  preferences: FilterPreferences,
): string {
  return JSON.stringify({
    ...preferences,
    budget:
      preferences.budget === Number.POSITIVE_INFINITY
        ? 'unlimited'
        : preferences.budget,
  })
}

export function parseFilterPreferences(
  serialized: string | null,
): FilterPreferences {
  if (!serialized) {
    return createEmptyFilterPreferences()
  }

  try {
    const value: unknown = JSON.parse(serialized)
    if (typeof value !== 'object' || value === null) {
      return createEmptyFilterPreferences()
    }

    const stored = value as Record<string, unknown>
    const category =
      typeof stored.category === 'string' && categories.has(stored.category)
        ? (stored.category as CategoryFilter)
        : null
    const budget =
      stored.budget === 'unlimited'
        ? Number.POSITIVE_INFINITY
        : typeof stored.budget === 'number' && budgets.has(stored.budget)
          ? stored.budget
          : null
    const travelMode =
      typeof stored.travelMode === 'string' &&
      travelModes.has(stored.travelMode as TravelMode)
        ? (stored.travelMode as TravelMode)
        : null
    const travelTimeLimit = travelTimeLimits.has(
      stored.travelTimeLimit as TravelTimeLimit,
    )
      ? (stored.travelTimeLimit as TravelTimeLimit)
      : null

    return { category, budget, travelMode, travelTimeLimit }
  } catch {
    return createEmptyFilterPreferences()
  }
}
