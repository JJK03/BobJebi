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
  const [isDrawing, setIsDrawing] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const candidates = useMemo(() => {
    if (
      !position ||
      category === null ||
      budget === null ||
      travelMode === null ||
      travelTimeLimit === null
    ) {
      return []
    }

    return filterRestaurants(restaurants, {
      userPosition: position,
      category,
      budget,
      maxDistanceMeters: getTravelDistanceLimitMeters(
        travelMode,
        travelTimeLimit,
      ),
    })
  }, [restaurants, position, category, budget, travelMode, travelTimeLimit])

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
    locationStatus === 'success' &&
    allConditionsSelected
  const candidateDescription = getCandidateDescription(category, budget)

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="오늘 뭐 먹지 홈">
          <span className="brand-mark">냠</span>
          <span>오늘 뭐 먹지?</span>
        </a>
        <p>내 위치와 예산에 맞는 착한가격 식당 제비뽑기</p>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="hero-kicker">전국 9,407개 착한가격업소</p>
            <h1>
              결정은 제비뽑기에게,
              <br />맛있는 한 끼는 나에게.
            </h1>
            <p>
              현재 위치, 먹고 싶은 종류, 예산만 고르면
              <br className="desktop-break" /> 가까운 식당을 공정하게 골라드려요.
            </p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="plate">
              <span className="food food-one">🍚</span>
              <span className="food food-two">🥟</span>
              <span className="food food-three">🍜</span>
              <span className="food food-four">🍛</span>
            </div>
            <span className="price-tag">만원으로 뭐 먹지?</span>
          </div>
        </section>

        <LocationRequest status={locationStatus} onRequest={requestLocation} />

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
