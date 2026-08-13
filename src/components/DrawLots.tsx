import type { CSSProperties } from 'react'

const MAX_VISIBLE_LOTS = 11
const LOT_COLORS = ['#f0c94d', '#d9e6d8', '#e8704f', '#eee7d8']

interface DrawLotsProps {
  candidateCount: number
  candidateDescription: string
  allConditionsSelected: boolean
  winnerName?: string
  isDrawing: boolean
  disabled: boolean
  onDraw: () => void
}

export function DrawLots({
  candidateCount,
  candidateDescription,
  allConditionsSelected,
  winnerName,
  isDrawing,
  disabled,
  onDraw,
}: DrawLotsProps) {
  const visibleLotCount = Math.min(candidateCount, MAX_VISIBLE_LOTS)
  const hiddenLotCount = Math.max(candidateCount - visibleLotCount, 0)

  return (
    <section className="draw-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 · 추첨</p>
          <h2>후보에서 한 곳 뽑기</h2>
        </div>
        <span className="candidate-count">
          후보 {candidateCount.toLocaleString()}곳
        </span>
      </div>

      <div className={`draw-stage ${isDrawing ? 'is-drawing' : ''}`} aria-live="polite">
        <div className="ticket-bundle" aria-hidden="true">
          {Array.from({ length: visibleLotCount }, (_, index) => {
            const progress = visibleLotCount === 1 ? 0.5 : index / (visibleLotCount - 1)
            const x = -96 + progress * 192
            const rotation = -17 + progress * 34

            return (
              <span
                className="lot-ticket"
                style={
                  {
                    '--lot-x': `${x}px`,
                    '--lot-rotation': `${rotation}deg`,
                    '--lot-color': LOT_COLORS[index % LOT_COLORS.length],
                    '--lot-delay': `${-40 - index * 37}ms`,
                    '--lot-duration': `${480 + (index % 4) * 40}ms`,
                  } as CSSProperties
                }
                key={index}
              />
            )
          })}
          {isDrawing && <span className="picked-lot" />}
          {hiddenLotCount > 0 && (
            <span className="hidden-lot-count">외 {hiddenLotCount.toLocaleString()}곳</span>
          )}
        </div>

        <div className={`winning-ticket ${winnerName ? 'is-revealed' : ''}`}>
          {isDrawing ? (
            <>
              <span className="ticket-label">제비를 섞는 중</span>
              <strong>두근두근…</strong>
            </>
          ) : winnerName ? (
            <>
              <span className="ticket-label">오늘 뽑힌 식당</span>
              <strong>{winnerName}</strong>
            </>
          ) : (
            <>
              <span className="ticket-label">
                {allConditionsSelected
                  ? candidateDescription
                  : '조건을 모두 선택해 주세요'}
              </span>
              <strong>
                {!allConditionsSelected
                  ? '음식·예산·이동 조건을 골라주세요'
                  : candidateCount > 0
                    ? `${candidateCount.toLocaleString()}곳 중 한 곳`
                    : '조건에 맞는 후보가 없어요'}
              </strong>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        className="primary-button"
        onClick={onDraw}
        disabled={disabled || isDrawing}
      >
        {isDrawing ? '제비를 뽑는 중…' : winnerName ? '다시 뽑기' : '한 곳 뽑기'}
      </button>
      {disabled && (
        <p className="draw-help">
          현재 위치를 확인하고 후보가 있어야 제비를 뽑을 수 있어요.
        </p>
      )}
    </section>
  )
}
