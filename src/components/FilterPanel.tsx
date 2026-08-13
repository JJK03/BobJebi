import {
  BUDGET_OPTIONS,
  CATEGORY_FILTER_OPTIONS,
  getTravelRangeSummary,
  getWideTravelRangeLabel,
  TRAVEL_MODE_OPTIONS,
  TRAVEL_TIME_LIMIT_OPTIONS,
} from '../domain/filterOptions'
import type { CategoryFilter } from '../domain/restaurant'
import type { TravelMode, TravelTimeLimit } from '../domain/travel'
import './FilterPanel.css'

interface FilterPanelProps {
  category: CategoryFilter | null
  budget: number | null
  travelMode: TravelMode | null
  travelTimeLimit: TravelTimeLimit | null
  hasSelections: boolean
  onCategoryChange: (category: CategoryFilter) => void
  onBudgetChange: (budget: number) => void
  onTravelModeChange: (mode: TravelMode) => void
  onTravelTimeChange: (time: TravelTimeLimit) => void
  onReset: () => void
}

export function FilterPanel({
  category,
  budget,
  travelMode,
  travelTimeLimit,
  hasSelections,
  onCategoryChange,
  onBudgetChange,
  onTravelModeChange,
  onTravelTimeChange,
  onReset,
}: FilterPanelProps) {
  const wideRangeLabel = travelMode
    ? getWideTravelRangeLabel(travelMode)
    : '넓게 보기'

  return (
    <section className="filter-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 · 조건</p>
          <h2>오늘의 조건</h2>
        </div>
        {hasSelections ? (
          <button className="filter-reset-button" type="button" onClick={onReset}>
            선택 초기화
          </button>
        ) : (
          <span>내 취향대로</span>
        )}
      </div>

      <fieldset>
        <legend>음식 종류</legend>
        <div className="chip-group">
          {CATEGORY_FILTER_OPTIONS.map((option) => (
            <button
              type="button"
              className={category === option ? 'chip is-selected' : 'chip'}
              aria-pressed={category === option}
              onClick={() => onCategoryChange(option)}
              key={option}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>한 사람 예산</legend>
        <div className="chip-group two-columns">
          {BUDGET_OPTIONS.map((option) => (
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
          {TRAVEL_MODE_OPTIONS.map((option) => (
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
          {TRAVEL_TIME_LIMIT_OPTIONS.map((option) => (
            <button
              type="button"
              className={
                travelTimeLimit === option.value ? 'chip is-selected' : 'chip'
              }
              aria-pressed={travelTimeLimit === option.value}
              onClick={() => onTravelTimeChange(option.value)}
              disabled={travelMode === null}
              key={option.label}
            >
              {option.value === 'wide' ? wideRangeLabel : option.label}
            </button>
          ))}
        </div>
        <p className="filter-note">
          {travelMode === null
            ? '도보 또는 자차를 먼저 선택해 주세요.'
            : `직선거리 기준이며, 최대 범위는 ${getTravelRangeSummary()}예요. 실제 경로와 다를 수 있어요.`}
        </p>
      </fieldset>
    </section>
  )
}
