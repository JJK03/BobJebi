interface EmptyStateProps {
  onRemoveTimeLimit: () => void
  onRemoveBudgetLimit: () => void
}

export function EmptyState({
  onRemoveTimeLimit,
  onRemoveBudgetLimit,
}: EmptyStateProps) {
  return (
    <section className="empty-state" role="status">
      <span aria-hidden="true">🍽️</span>
      <div>
        <h2>선택한 조건에 해당하는 식당이 없어요</h2>
        <p>이동 시간이나 예산 제한을 풀면 후보를 찾기 쉬워집니다.</p>
      </div>
      <div className="empty-actions">
        <button type="button" className="secondary-button" onClick={onRemoveTimeLimit}>
          최대 범위로 넓히기
        </button>
        <button type="button" className="secondary-button" onClick={onRemoveBudgetLimit}>
          예산 제한 풀기
        </button>
      </div>
    </section>
  )
}
