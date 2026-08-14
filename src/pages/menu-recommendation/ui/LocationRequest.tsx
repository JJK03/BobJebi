import { useState, type FormEvent } from "react";
import "./LocationRequest.css";
import type { LocationSearchResult } from "../../../shared/api/kakao";
import type { LocationStatus } from "../model/useGeolocation";
import { useLocationSearch } from "../model/useLocationSearch";

const statusMessages: Partial<Record<LocationStatus, string>> = {
  denied:
    "위치 권한이 거부되었습니다. 브라우저 주소창의 위치 권한을 허용해 주세요.",
  unavailable: "현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  timeout: "위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.",
  unsupported: "이 브라우저에서는 위치 기능을 지원하지 않습니다.",
  error: "위치를 가져오는 중 문제가 발생했습니다.",
};

interface LocationRequestProps {
  status: LocationStatus;
  selectedLocation?: LocationSearchResult;
  onRequest: () => void;
  onSelectLocation: (location: LocationSearchResult) => void;
}

export function LocationRequest({
  status,
  selectedLocation,
  onRequest,
  onSelectLocation,
}: LocationRequestProps) {
  const [query, setQuery] = useState("");
  const {
    results,
    status: searchStatus,
    error: searchError,
    search,
    clear,
  } = useLocationSearch();
  const hasLocation = status === "success";
  const hasManualLocation = Boolean(selectedLocation);
  const isRequesting = status === "requesting";
  const isChecking = status === "checking";
  const isSearching = searchStatus === "searching";

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search(query);
  };

  const selectLocation = (location: LocationSearchResult) => {
    onSelectLocation(location);
    setQuery("");
    clear();
  };

  return (
    <section
      className={`location-card ${hasLocation || hasManualLocation ? "is-ready" : ""}`}
    >
      <div className="location-icon" aria-hidden="true">
        {hasLocation || hasManualLocation ? "✓" : "01"}
      </div>
      <div className="location-copy">
        <p className="eyebrow">01 · 위치</p>
        <h2>
          {hasManualLocation
            ? `${selectedLocation?.name} 주변을 보고 있어요`
            : hasLocation
              ? "현재 위치를 확인했어요"
              : isChecking
                ? "위치 권한을 확인하고 있어요"
                : "내 주변 식당 찾기"}
        </h2>
        <p>
          {hasManualLocation
            ? selectedLocation?.address
            : hasLocation
              ? "브라우저가 허용한 현재 위치를 새로 확인했습니다."
              : isChecking
                ? "브라우저에 저장된 실제 권한 상태를 확인합니다."
                : "정확한 주변 추천을 위해 현재 위치가 필요합니다."}
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
        disabled={isRequesting || (isChecking && !hasManualLocation)}
      >
        {hasManualLocation
          ? "현재 위치로 돌아가기"
          : isChecking
            ? "권한 확인 중…"
            : isRequesting
              ? "위치 확인 중…"
              : hasLocation
                ? "위치 새로고침"
                : status === "denied"
                  ? "위치 권한 다시 확인"
                  : "위치 권한 허용하고 시작하기"}
      </button>

      <div className="location-search-area">
        <div className="location-divider">
          <span>또는 원하는 위치로 찾기</span>
        </div>
        <form className="location-search-form" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="location-query">
            원하는 위치 검색
          </label>
          <input
            id="location-query"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="동네, 역, 건물명 또는 주소"
            autoComplete="off"
            enterKeyHint="search"
            disabled={searchStatus === "unconfigured"}
          />
          <button
            className="location-search-button"
            type="submit"
            disabled={
              !query.trim() || isSearching || searchStatus === "unconfigured"
            }
          >
            {isSearching ? "검색 중…" : "검색"}
          </button>
        </form>

        {searchStatus === "unconfigured" && (
          <p className="location-search-message" role="status">
            위치 검색을 사용하려면 카카오 JavaScript 키 설정이 필요합니다.
          </p>
        )}
        {searchStatus === "empty" && (
          <p className="location-search-message" role="status">
            검색 결과가 없어요. 동네 이름이나 주소를 조금 더 자세히 입력해
            주세요.
          </p>
        )}
        {searchStatus === "error" && (
          <p className="location-search-message is-error" role="alert">
            {searchError}
          </p>
        )}
        {results.length > 0 && (
          <ul className="location-search-results" aria-label="위치 검색 결과">
            {results.map((result) => (
              <li key={result.id}>
                <button type="button" onClick={() => selectLocation(result)}>
                  <strong>{result.name}</strong>
                  <span>{result.address}</span>
                  <i aria-hidden="true">선택</i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
