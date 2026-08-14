import {
  BUDGET_OPTIONS,
  CATEGORY_FILTER_OPTIONS,
  TRAVEL_MODE_OPTIONS,
  TRAVEL_TIME_LIMIT_OPTIONS,
  UNLIMITED_BUDGET,
  isUnlimitedBudget,
  type CategoryFilter,
  type TravelMode,
  type TravelTimeLimit,
} from '../../../entities/restaurant'

export interface FilterPreferences {
  category: CategoryFilter | null
  budget: number | null
  travelMode: TravelMode | null
  travelTimeLimit: TravelTimeLimit | null
}

const categories = new Set<string>(CATEGORY_FILTER_OPTIONS)
const budgets = new Set<number>(BUDGET_OPTIONS.map(({ value }) => value))
const travelModes = new Set<TravelMode>(
  TRAVEL_MODE_OPTIONS.map(({ value }) => value),
)
const travelTimeLimits = new Set<TravelTimeLimit>(
  TRAVEL_TIME_LIMIT_OPTIONS.map(({ value }) => value),
)

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
      preferences.budget !== null && isUnlimitedBudget(preferences.budget)
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
        ? UNLIMITED_BUDGET
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
