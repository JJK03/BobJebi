import {
  ALL_CATEGORY_FILTER,
  RESTAURANT_CATEGORIES,
  type CategoryFilter,
} from './restaurant'
import {
  getWideTravelDistanceMeters,
  type TravelMode,
  type TravelTimeLimit,
} from './travel'

interface FilterOption<Value> {
  readonly value: Value
  readonly label: string
}

export const UNLIMITED_BUDGET = Number.POSITIVE_INFINITY

export const CATEGORY_FILTER_OPTIONS: readonly CategoryFilter[] = [
  ALL_CATEGORY_FILTER,
  ...RESTAURANT_CATEGORIES,
]

export const BUDGET_OPTIONS = [
  { value: 10_000, label: '~10,000원' },
  { value: 15_000, label: '~15,000원' },
  { value: 20_000, label: '~20,000원' },
  { value: UNLIMITED_BUDGET, label: '제한 없음' },
] as const satisfies readonly FilterOption<number>[]

export const TRAVEL_MODE_OPTIONS = [
  { value: 'walking', label: '🚶 도보', rangeLabel: '도보' },
  { value: 'driving', label: '🚗 자차', rangeLabel: '자차' },
] as const satisfies readonly (FilterOption<TravelMode> & {
  readonly rangeLabel: string
})[]

export const TRAVEL_TIME_LIMIT_OPTIONS = [
  { value: 10, label: '10분 이내' },
  { value: 20, label: '20분 이내' },
  { value: 'wide', label: '넓게 보기' },
] as const satisfies readonly FilterOption<TravelTimeLimit>[]

function formatRangeDistance(distanceMeters: number): string {
  if (distanceMeters >= 1_000) {
    return `${distanceMeters / 1_000}km`
  }

  return `${distanceMeters.toLocaleString('ko-KR')}m`
}

export function getWideTravelRangeLabel(mode: TravelMode): string {
  return `최대 ${formatRangeDistance(getWideTravelDistanceMeters(mode))}`
}

export function getTravelRangeSummary(): string {
  return TRAVEL_MODE_OPTIONS.map(
    ({ value, rangeLabel }) =>
      `${rangeLabel} ${formatRangeDistance(getWideTravelDistanceMeters(value))}`,
  ).join(' · ')
}

export function isUnlimitedBudget(budget: number): boolean {
  return budget === UNLIMITED_BUDGET
}
