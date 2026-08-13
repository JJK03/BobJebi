import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { DrawLots } from './components/DrawLots'
import { EmptyState } from './components/EmptyState'
import { FilterPanel } from './components/FilterPanel'
import { LocationRequest } from './components/LocationRequest'
import { RecommendationCard } from './components/RecommendationCard'
import { filterRestaurants, type RestaurantCandidate } from './domain/filters'
import { pickRandomItem } from './domain/random'
import type { CategoryFilter } from './domain/restaurant'
import {
  getTravelDistanceLimitMeters,
  type TravelMode,
  type TravelTimeLimit,
} from './domain/travel'
import { useGeolocation } from './hooks/useGeolocation'
import { useFilterPreferences } from './hooks/useFilterPreferences'
import { useRestaurants } from './hooks/useRestaurants'
import type { LocationSearchResult } from './services/kakaoLocationSearch'
import { getCandidateDescription } from './utils/candidateDescription'

function App() {
  const { restaurants, status: dataStatus, error: dataError } = useRestaurants()
  const {
    position,
    status: locationStatus,
    requestLocation,
  } = useGeolocation()
  const { preferences, updatePreference, resetPreferences } =
    useFilterPreferences()
  const { category, budget, travelMode, travelTimeLimit } = preferences
  const [selected, setSelected] = useState<RestaurantCandidate>()
  const [manualLocation, setManualLocation] = useState<LocationSearchResult>()
  const [isDrawing, setIsDrawing] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const activePosition = manualLocation?.coordinates ?? position
  const candidates = useMemo(() => {
    if (
      !activePosition ||
      category === null ||
      budget === null ||
      travelMode === null ||
      travelTimeLimit === null
    ) {
      return []
    }

    return filterRestaurants(restaurants, {
      userPosition: activePosition,
      category,
      budget,
      maxDistanceMeters: getTravelDistanceLimitMeters(
        travelMode,
        travelTimeLimit,
      ),
    })
  }, [
    restaurants,
    activePosition,
    category,
    budget,
    travelMode,
    travelTimeLimit,
  ])

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    },
    [],
  )

  const clearResult = () => {
    setSelected(undefined)
    setIsDrawing(false)
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
  }

  const drawRestaurant = () => {
    if (isDrawing) {
      return
    }

    const winner = pickRandomItem(candidates)
    if (!winner) {
      return
    }

    setSelected(undefined)
    setIsDrawing(true)
    timerRef.current = window.setTimeout(() => {
      setSelected(winner)
      setIsDrawing(false)
      window.setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: 'smooth' }),
        50,
      )
    }, 1_800)
  }

  const changeCategory = (value: CategoryFilter) => {
    clearResult()
    updatePreference('category', value)
  }

  const changeBudget = (value: number) => {
    clearResult()
    updatePreference('budget', value)
  }

  const changeTravelMode = (value: TravelMode) => {
    clearResult()
    updatePreference('travelMode', value)
  }

  const changeTravelTime = (value: TravelTimeLimit) => {
    clearResult()
    updatePreference('travelTimeLimit', value)
  }

  const resetFilters = () => {
    clearResult()
    resetPreferences()
  }

  const requestCurrentLocation = () => {
    clearResult()
    setManualLocation(undefined)
    requestLocation()
  }

  const selectManualLocation = (location: LocationSearchResult) => {
    clearResult()
    setManualLocation(location)
  }

  const scrollToFilters = () => {
    document.querySelector('.filter-panel')?.scrollIntoView({ behavior: 'smooth' })
  }

  const allConditionsSelected =
    category !== null &&
    budget !== null &&
    travelMode !== null &&
    travelTimeLimit !== null
  const isReady =
    dataStatus === 'success' &&
    Boolean(activePosition) &&
    allConditionsSelected
  const candidateDescription = getCandidateDescription(category, budget)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="오늘 뭐 먹지 홈">
          <span className="brand-mark" aria-hidden="true">한끼</span>
          <span className="brand-name">오늘 뭐 먹지?</span>
        </a>
        <p><span aria-hidden="true" />전국 착한가격업소에서 골라요</p>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-kicker">가까운 곳에서 · 예산 안에서</p>
            <h1>
              오늘 밥은
              <br />뽑아서 정해요.
            </h1>
            <p>
              위치와 조건을 고르면 가까운 착한가격 식당 중
              <br className="desktop-break" /> 한 곳을 가볍게 뽑아드려요.
            </p>
          </div>
          <div className="hero-ticket" aria-hidden="true">
            <div className="hero-ticket-head">
              <span>LOCAL MEAL LOT</span>
              <span>GOOD PRICE</span>
            </div>
            <div className="hero-ticket-number">
              <strong>9,407</strong>
              <span>등록 식당</span>
            </div>
            <div className="hero-ticket-lines">
              <span>위치</span><i />
              <span>예산</span><i />
              <span>메뉴</span><i />
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

        {dataStatus === 'loading' && (
          <div className="data-notice" role="status">
            <span className="loading-dot" /> 전국 식당 데이터를 불러오는 중입니다…
          </div>
        )}
        {dataStatus === 'error' && (
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
            hasSelections={Object.values(preferences).some((value) => value !== null)}
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
            canResetCategory={category !== '전체'}
            canRemoveBudgetLimit={Number.isFinite(budget)}
            canExpandTravelRange={travelTimeLimit !== 'wide'}
            travelRangeLabel={
              travelMode === 'driving'
                ? '최대 20km로 넓히기'
                : '최대 2km로 넓히기'
            }
            onResetCategory={() => changeCategory('전체')}
            onRemoveBudgetLimit={() =>
              changeBudget(Number.POSITIVE_INFINITY)
            }
            onExpandTravelRange={() => changeTravelTime('wide')}
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
      </main>

      <footer>
        행정안전부 착한가격업소 데이터를 활용한 위치 기반 추천 서비스
        <span>최대 검색 범위: 도보 2km · 자차 20km</span>
      </footer>
    </div>
  )
}

export default App
