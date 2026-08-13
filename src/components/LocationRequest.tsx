import type { LocationStatus } from '../hooks/useGeolocation'

const statusMessages: Partial<Record<LocationStatus, string>> = {
  denied: '위치 권한이 거부되었습니다. 브라우저 주소창의 위치 권한을 허용해 주세요.',
  unavailable: '현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  timeout: '위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.',
  unsupported: '이 브라우저에서는 위치 기능을 지원하지 않습니다.',
  error: '위치를 가져오는 중 문제가 발생했습니다.',
}

interface LocationRequestProps {
  status: LocationStatus
  onRequest: () => void
}

export function LocationRequest({ status, onRequest }: LocationRequestProps) {
  const hasLocation = status === 'success'
  const isRequesting = status === 'requesting'
  const isChecking = status === 'checking'

  return (
    <section className={`location-card ${hasLocation ? 'is-ready' : ''}`}>
      <div className="location-icon" aria-hidden="true">
        {hasLocation ? '✓' : '01'}
      </div>
      <div className="location-copy">
        <p className="eyebrow">01 · 위치</p>
        <h2>
          {hasLocation
            ? '현재 위치를 확인했어요'
            : isChecking
              ? '위치 권한을 확인하고 있어요'
              : '내 주변 식당 찾기'}
        </h2>
        <p>
          {hasLocation
            ? '브라우저가 허용한 현재 위치를 새로 확인했습니다.'
            : isChecking
              ? '브라우저에 저장된 실제 권한 상태를 확인합니다.'
              : '정확한 주변 추천을 위해 현재 위치가 필요합니다.'}
        </p>
        {statusMessages[status] && (
          <p className="location-error" role="alert">
            {statusMessages[status]}
          </p>
        )}
      </div>
      <button
        className="secondary-button"
        type="button"
        onClick={onRequest}
        disabled={isRequesting || isChecking}
      >
        {isChecking
          ? '권한 확인 중…'
          : isRequesting
          ? '위치 확인 중…'
          : hasLocation
            ? '위치 새로고침'
            : status === 'denied'
              ? '위치 권한 다시 확인'
            : '위치 권한 허용하고 시작하기'}
      </button>
    </section>
  )
}
