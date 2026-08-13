interface DrawLotsProps {
  candidateCount: number
  candidateDescription: string
  winnerName?: string
  isDrawing: boolean
  disabled: boolean
  onDraw: () => void
}

export function DrawLots({
  candidateCount,
  candidateDescription,
  winnerName,
  isDrawing,
  disabled,
  onDraw,
}: DrawLotsProps) {
  return (
    <section className="draw-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">STEP 3</p>
          <h2>오늘의 제비뽑기</h2>
        </div>
        <span className="candidate-count">
          후보 {candidateCount.toLocaleString()}곳
        </span>
      </div>

      <div className={`draw-stage ${isDrawing ? 'is-drawing' : ''}`} aria-live="polite">
        <div className="ticket-bundle" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span className={`lot-ticket lot-${index + 1}`} key={index} />
          ))}
          {isDrawing && <span className="picked-lot" />}
        </div>

        <div className={`winning-ticket ${winnerName ? 'is-revealed' : ''}`}>
          {isDrawing ? (
            <>
              <span className="ticket-label">제비를 섞는 중</span>
              <strong>두근두근…</strong>
            </>
          ) : winnerName ? (
            <>
              <span className="ticket-label">오늘의 당첨 제비</span>
              <strong>{winnerName}</strong>
            </>
          ) : (
            <>
              <span className="ticket-label">{candidateDescription}</span>
              <strong>{candidateCount > 0 ? `${candidateCount.toLocaleString()}곳 중 한 곳` : '조건을 골라주세요'}</strong>
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
        {isDrawing ? '제비를 뽑는 중…' : winnerName ? '다시 뽑기' : '제비 뽑기'}
      </button>
      {disabled && (
        <p className="draw-help">
          현재 위치를 확인하고 후보가 있어야 제비를 뽑을 수 있어요.
        </p>
      )}
    </section>
  )
}
