import {
  RESTAURANT_CATEGORIES,
  type CategoryFilter,
} from '../domain/restaurant'
import type { TravelMode, TravelTimeLimit } from '../domain/travel'

const BUDGETS = [
  { value: 10_000, label: '~10,000원' },
  { value: 15_000, label: '~15,000원' },
  { value: 20_000, label: '~20,000원' },
  { value: Number.POSITIVE_INFINITY, label: '제한 없음' },
]

const TRAVEL_MODES: { value: TravelMode; label: string }[] = [
  { value: 'walking', label: '🚶 도보' },
  { value: 'driving', label: '🚗 자차' },
]

const TIME_LIMITS: { value: TravelTimeLimit; label: string }[] = [
  { value: 10, label: '10분 이내' },
  { value: 20, label: '20분 이내' },
  { value: 'wide', label: '넓게 보기' },
]

interface FilterPanelProps {
  category: CategoryFilter
  budget: number
  travelMode: TravelMode
  travelTimeLimit: TravelTimeLimit
  onCategoryChange: (category: CategoryFilter) => void
  onBudgetChange: (budget: number) => void
  onTravelModeChange: (mode: TravelMode) => void
  onTravelTimeChange: (time: TravelTimeLimit) => void
}

export function FilterPanel({
  category,
  budget,
  travelMode,
  travelTimeLimit,
  onCategoryChange,
  onBudgetChange,
  onTravelModeChange,
  onTravelTimeChange,
}: FilterPanelProps) {
  const wideRangeLabel = travelMode === 'walking' ? '최대 2km' : '최대 20km'

  return (
    <section className="filter-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">STEP 2</p>
          <h2>오늘의 조건</h2>
        </div>
        <span>내 취향대로</span>
      </div>

      <fieldset>
        <legend>음식 종류</legend>
        <div className="chip-group">
          {(['전체', ...RESTAURANT_CATEGORIES] as CategoryFilter[]).map(
            (option) => (
              <button
                type="button"
                className={category === option ? 'chip is-selected' : 'chip'}
                aria-pressed={category === option}
                onClick={() => onCategoryChange(option)}
                key={option}
              >
                {option}
              </button>
            ),
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>한 사람 예산</legend>
        <div className="chip-group two-columns">
          {BUDGETS.map((option) => (
            <button
              type="button"
              className={budget === option.value ? 'chip is-selected' : 'chip'}
              aria-pressed={budget === option.value}
              onClick={() => onBudgetChange(option.value)}
              key={option.label}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>이동 기준</legend>
        <div className="chip-group two-columns">
          {TRAVEL_MODES.map((option) => (
            <button
              type="button"
              className={travelMode === option.value ? 'chip is-selected' : 'chip'}
              aria-pressed={travelMode === option.value}
              onClick={() => onTravelModeChange(option.value)}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>예상 이동 시간</legend>
        <div className="chip-group three-columns">
          {TIME_LIMITS.map((option) => (
            <button
              type="button"
              className={
                travelTimeLimit === option.value ? 'chip is-selected' : 'chip'
              }
              aria-pressed={travelTimeLimit === option.value}
              onClick={() => onTravelTimeChange(option.value)}
              key={option.label}
            >
              {option.value === 'wide' ? wideRangeLabel : option.label}
            </button>
          ))}
        </div>
        <p className="filter-note">
          직선거리 기준이며, 최대 범위는 도보 2km·자차 20km예요. 실제 경로와
          다를 수 있어요.
        </p>
      </fieldset>
    </section>
  )
}
