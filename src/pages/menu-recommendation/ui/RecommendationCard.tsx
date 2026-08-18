import {
  estimateTravelTimeMinutes,
  type RestaurantCandidate,
  type TravelMode,
} from "../../../entities/restaurant";
import "./RecommendationCard.css";

interface RecommendationCardProps {
  candidate: RestaurantCandidate;
  travelMode: TravelMode;
  onRetry: () => void;
  onChangeConditions: () => void;
}

const formatDistance = (meters: number) =>
  meters < 1_000
    ? `${Math.round(meters)}m`
    : `${(meters / 1_000).toFixed(1)}km`;

export function RecommendationCard({
  candidate,
  travelMode,
  onRetry,
  onChangeConditions,
}: RecommendationCardProps) {
  const { restaurant, category, affordableMenus, distanceMeters } = candidate;
  const kakaoMapUrl =
    restaurant.kakaoPlaceUrl ??
    (restaurant.kakaoPlaceId
      ? `https://map.kakao.com/link/map/${restaurant.kakaoPlaceId}`
      : `https://map.kakao.com/?q=${encodeURIComponent(`${restaurant.name} ${restaurant.district}`)}`);
  const hasKakaoPlace = Boolean(
    restaurant.kakaoPlaceUrl || restaurant.kakaoPlaceId,
  );
  const travelMinutes = estimateTravelTimeMinutes(distanceMeters, travelMode);
  const travelLabel = travelMode === "walking" ? "도보" : "자차";
  const visibleMenus = affordableMenus.slice(0, 8);
  const hiddenMenuCount = affordableMenus.length - visibleMenus.length;

  return (
    <section className="result-card" aria-labelledby="result-title">
      <div className="result-badge">오늘의 한 끼</div>
      <div className="result-title-row">
        <div>
          <p className="eyebrow">뽑기 결과</p>
          <h2 id="result-title">{restaurant.name}</h2>
          <p className="result-summary">
            {category} · 직선거리 {formatDistance(distanceMeters)} ·
            예상 {travelLabel} {travelMinutes}분
          </p>
        </div>
        <span className="category-badge">{category}</span>
      </div>

      <div className="menu-box">
        <h3>예산 안에서 먹을 수 있는 메뉴</h3>
        <ul>
          {visibleMenus.map((menu) => (
            <li key={`${menu.name}-${menu.price}`}>
              <span>{menu.name}</span>
              <strong>{menu.price.toLocaleString("ko-KR")}원</strong>
            </li>
          ))}
        </ul>
        {hiddenMenuCount > 0 && (
          <p className="menu-more">그 외 예산 안의 메뉴 {hiddenMenuCount}개</p>
        )}
      </div>

      <dl className="restaurant-details">
        <div>
          <dt>주소</dt>
          <dd>{restaurant.address}</dd>
        </div>
        {restaurant.phone && (
          <div>
            <dt>전화</dt>
            <dd>
              <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>
            </dd>
          </div>
        )}
      </dl>

      <div className="result-actions">
        <a
          className="map-button"
          href={kakaoMapUrl}
          target="_blank"
          rel="noreferrer"
        >
          {hasKakaoPlace
            ? "카카오맵에서 식당 보기 ↗"
            : "카카오맵에서 식당 검색 ↗"}
        </a>
        <button className="secondary-button" type="button" onClick={onRetry}>
          같은 조건으로 다시
        </button>
        <button
          className="text-button"
          type="button"
          onClick={onChangeConditions}
        >
          조건 변경하기
        </button>
      </div>
    </section>
  );
}
