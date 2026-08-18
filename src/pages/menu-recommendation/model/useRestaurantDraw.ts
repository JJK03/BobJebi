import { useCallback, useEffect, useRef, useState } from 'react'
import type { RestaurantCandidate } from '../../../entities/restaurant'
import { pickRandomItem } from '../../../shared/lib/random'

const DRAW_DURATION_MS = 1_800

type DrawState =
  | { status: 'idle' }
  | { status: 'drawing' }
  | { status: 'selected'; restaurant: RestaurantCandidate }

export function useRestaurantDraw(
  candidates: readonly RestaurantCandidate[],
) {
  const [state, setState] = useState<DrawState>({ status: 'idle' })
  const timerRef = useRef<number | undefined>(undefined)
  const drawnRestaurantIdsRef = useRef(new Set<string>())
  const lastSelectedRestaurantIdRef = useRef<string | undefined>(undefined)

  const clearTimer = useCallback(() => {
    if (timerRef.current === undefined) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const clearResult = useCallback(() => {
    clearTimer()
    drawnRestaurantIdsRef.current.clear()
    lastSelectedRestaurantIdRef.current = undefined
    setState({ status: 'idle' })
  }, [clearTimer])

  const drawRestaurant = useCallback(() => {
    if (timerRef.current !== undefined) {
      return
    }

    let availableCandidates = candidates.filter(
      ({ restaurant }) =>
        !drawnRestaurantIdsRef.current.has(restaurant.id),
    )

    if (availableCandidates.length === 0) {
      drawnRestaurantIdsRef.current.clear()
      availableCandidates =
        candidates.length > 1
          ? candidates.filter(
              ({ restaurant }) =>
                restaurant.id !== lastSelectedRestaurantIdRef.current,
            )
          : [...candidates]
    }

    const winner = pickRandomItem(availableCandidates)
    if (!winner) {
      return
    }

    setState({ status: 'drawing' })
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined
      drawnRestaurantIdsRef.current.add(winner.restaurant.id)
      lastSelectedRestaurantIdRef.current = winner.restaurant.id
      setState({ status: 'selected', restaurant: winner })
    }, DRAW_DURATION_MS)
  }, [candidates])

  return {
    selected: state.status === 'selected' ? state.restaurant : undefined,
    isDrawing: state.status === 'drawing',
    drawRestaurant,
    clearResult,
  }
}
