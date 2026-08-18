import { useEffect, useMemo, useRef, useState } from "react";
import "./MenuRecommendationPage.css";
import { DrawLots } from "./DrawLots";
import { EmptyState } from "./EmptyState";
import { FilterPanel } from "./FilterPanel";
import { LocationRequest } from "./LocationRequest";
import { RecommendationCard } from "./RecommendationCard";
import {
  ALL_CATEGORY_FILTER,
  RESTAURANT_SOURCES,
  UNLIMITED_BUDGET,
  filterRestaurants,
  getTravelRangeSummary,
  getWideTravelRangeLabel,
  isUnlimitedBudget,
  getTravelDistanceLimitMeters,
  type CategoryFilter,
  type RestaurantSource,
  type TravelMode,
  type TravelTimeLimit,
} from "../../../entities/restaurant";
import type { LocationSearchResult } from "../../../shared/api/kakao";
import { getCandidateDescription } from "../lib/candidateDescription";
import { useFilterPreferences } from "../model/useFilterPreferences";
import { useGeolocation } from "../model/useGeolocation";
import { useRestaurantDraw } from "../model/useRestaurantDraw";
import { useRestaurants } from "../model/useRestaurants";

export function MenuRecommendationPage() {
  const [activeSource, setActiveSource] =
    useState<RestaurantSource>("good-price");
  const sourceContent = RESTAURANT_SOURCES[activeSource];
  const {
    position,
    status: locationStatus,
    requestLocation,
  } = useGeolocation();
  const { preferences, updatePreference, resetPreferences } =
    useFilterPreferences();
  const { category, budget, travelMode, travelTimeLimit } = preferences;
  const [manualLocation, setManualLocation] = useState<LocationSearchResult>();
  const resultRef = useRef<HTMLDivElement>(null);
  const activePosition = manualLocation?.coordinates ?? position;
  const maxDistanceMeters =
    travelMode !== null && travelTimeLimit !== null
      ? getTravelDistanceLimitMeters(travelMode, travelTimeLimit)
      : undefined;
  const {
    restaurants,
    totalCount,
    status: dataStatus,
    error: dataError,
  } = useRestaurants(activeSource, activePosition, maxDistanceMeters);
  const candidates = useMemo(() => {
    if (
      !activePosition ||
      category === null ||
      budget === null ||
      travelMode === null ||
      travelTimeLimit === null ||
      maxDistanceMeters === undefined
    ) {
      return [];
    }

    return filterRestaurants(restaurants, {
      userPosition: activePosition,
      category,
      budget,
      maxDistanceMeters,
    });
  }, [
    restaurants,
    activePosition,
    category,
    budget,
    travelMode,
    travelTimeLimit,
    maxDistanceMeters,
  ]);
  const { selected, isDrawing, drawRestaurant, clearResult } =
    useRestaurantDraw(candidates);

  useEffect(() => {
    if (!selected) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selected]);

  const changeCategory = (value: CategoryFilter) => {
    clearResult();
    updatePreference("category", value);
  };

  const changeBudget = (value: number) => {
    clearResult();
    updatePreference("budget", value);
  };

  const changeTravelMode = (value: TravelMode) => {
    clearResult();
    updatePreference("travelMode", value);
  };

  const changeTravelTime = (value: TravelTimeLimit) => {
    clearResult();
    updatePreference("travelTimeLimit", value);
  };

  const resetFilters = () => {
    clearResult();
    resetPreferences();
  };

  const requestCurrentLocation = () => {
    clearResult();
    setManualLocation(undefined);
    requestLocation();
  };

  const selectManualLocation = (location: LocationSearchResult) => {
    clearResult();
    setManualLocation(location);
  };

  const changeSource = (source: RestaurantSource) => {
    if (source === activeSource) {
      return;
    }

    clearResult();
    setActiveSource(source);
  };

  const scrollToFilters = () => {
    document
      .querySelector(".filter-panel")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const allConditionsSelected =
    category !== null &&
    budget !== null &&
    travelMode !== null &&
    travelTimeLimit !== null;
  const isReady =
    dataStatus === "success" &&
    Boolean(activePosition) &&
    allConditionsSelected;
  const candidateDescription = getCandidateDescription(category, budget);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="오늘 뭐 먹지 홈">
          <span className="brand-mark" aria-hidden="true">
            한끼
          </span>
          <span className="brand-name">오늘 뭐 먹지?</span>
        </a>
        <p>
          <span aria-hidden="true" />
          {sourceContent.headerLabel}
        </p>
      </header>

      <main id="top">
        <nav className="source-tabs" aria-label="식당 데이터 선택">
          <div role="tablist">
            {Object.entries(RESTAURANT_SOURCES).map(([source, content]) => (
              <button
                id={`source-tab-${source}`}
                type="button"
                role="tab"
                aria-selected={activeSource === source}
                aria-controls="source-panel"
                className={activeSource === source ? "is-active" : undefined}
                onClick={() => changeSource(source as RestaurantSource)}
                key={source}
              >
                {content.tabLabel}
              </button>
            ))}
          </div>
        </nav>

        <div
          id="source-panel"
          role="tabpanel"
          aria-labelledby={`source-tab-${activeSource}`}
        >
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-kicker">{sourceContent.kicker}</p>
            <h1>
              오늘 밥은
              <br />
              뽑아서 정해요.
            </h1>
            <p>
              {sourceContent.description}
              <br className="desktop-break" /> 한 곳을 가볍게 뽑아드려요.
            </p>
          </div>
          <div className="hero-ticket" aria-hidden="true">
            <div className="hero-ticket-head">
              <span>LOCAL MEAL LOT</span>
              <span>{sourceContent.ticketLabel}</span>
            </div>
            <div className="hero-ticket-number">
              <strong>
                {totalCount > 0
                  ? totalCount.toLocaleString("ko-KR")
                  : "—"}
              </strong>
              <span>등록 식당</span>
            </div>
            <div className="hero-ticket-lines">
              <span>위치</span>
              <i />
              <span>예산</span>
              <i />
              <span>메뉴</span>
              <i />
            </div>
            <p>조건에 맞는 후보만 넣고 한 곳을 뽑습니다.</p>
          </div>
        </section>

        <LocationRequest
          status={locationStatus}
          selectedLocation={manualLocation}
          onRequest={requestCurrentLocation}
          onSelectLocation={selectManualLocation}
        />

        {dataStatus === "loading" && (
          <div className="data-notice" role="status">
            <span className="loading-dot" /> {sourceContent.loadingLabel}
          </div>
        )}
        {dataStatus === "error" && (
          <div className="data-notice is-error" role="alert">
            {dataError}
          </div>
        )}

        <div className="planner-grid">
          <FilterPanel
            category={category}
            budget={budget}
            travelMode={travelMode}
            travelTimeLimit={travelTimeLimit}
            hasSelections={Object.values(preferences).some(
              (value) => value !== null,
            )}
            onCategoryChange={changeCategory}
            onBudgetChange={changeBudget}
            onTravelModeChange={changeTravelMode}
            onTravelTimeChange={changeTravelTime}
            onReset={resetFilters}
          />
          <DrawLots
            candidateCount={candidates.length}
            candidateDescription={candidateDescription}
            allConditionsSelected={allConditionsSelected}
            winnerName={selected?.restaurant.name}
            isDrawing={isDrawing}
            disabled={!isReady || candidates.length === 0}
            onDraw={drawRestaurant}
          />
        </div>

        {isReady && candidates.length === 0 && (
          <EmptyState
            canResetCategory={category !== ALL_CATEGORY_FILTER}
            canRemoveBudgetLimit={budget !== null && !isUnlimitedBudget(budget)}
            canExpandTravelRange={travelTimeLimit !== "wide"}
            travelRangeLabel={
              travelMode
                ? `${getWideTravelRangeLabel(travelMode)}로 넓히기`
                : "검색 범위 넓히기"
            }
            onResetCategory={() => changeCategory(ALL_CATEGORY_FILTER)}
            onRemoveBudgetLimit={() => changeBudget(UNLIMITED_BUDGET)}
            onExpandTravelRange={() => changeTravelTime("wide")}
          />
        )}

        <div ref={resultRef}>
          {selected && travelMode && (
            <RecommendationCard
              candidate={selected}
              travelMode={travelMode}
              onRetry={drawRestaurant}
              onChangeConditions={scrollToFilters}
            />
          )}
        </div>
        </div>
      </main>

      <footer>
        {sourceContent.footerLabel}
        <span>최대 검색 범위: {getTravelRangeSummary()}</span>
      </footer>
    </div>
  );
}

