import './EmptyState.css'

interface EmptyStateProps {
  canResetCategory: boolean
  canRemoveBudgetLimit: boolean
  canExpandTravelRange: boolean
  travelRangeLabel: string
  onResetCategory: () => void
  onRemoveBudgetLimit: () => void
  onExpandTravelRange: () => void
}

export function EmptyState({
  canResetCategory,
  canRemoveBudgetLimit,
  canExpandTravelRange,
  travelRangeLabel,
  onResetCategory,
  onRemoveBudgetLimit,
  onExpandTravelRange,
}: EmptyStateProps) {
  const hasActions =
    canResetCategory || canRemoveBudgetLimit || canExpandTravelRange

  return (
    <section className="empty-state" role="status">
      <span aria-hidden="true">0</span>
      <div>
        <h2>선택한 조건에 해당하는 식당이 없어요</h2>
        <p>
          {hasActions
            ? '아래 조건을 완화하면 후보를 찾기 쉬워집니다.'
            : '현재 위치의 최대 검색 범위에 등록된 식당이 없습니다.'}
        </p>
      </div>
      {hasActions && (
        <div className="empty-actions">
          {canResetCategory && (
            <button
              type="button"
              className="secondary-button"
              onClick={onResetCategory}
            >
              음식 종류 전체로 변경
            </button>
          )}
          {canRemoveBudgetLimit && (
            <button
              type="button"
              className="secondary-button"
              onClick={onRemoveBudgetLimit}
            >
              예산 제한 풀기
            </button>
          )}
          {canExpandTravelRange && (
            <button
              type="button"
              className="secondary-button"
              onClick={onExpandTravelRange}
            >
              {travelRangeLabel}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
