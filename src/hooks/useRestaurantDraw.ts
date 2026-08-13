import { useCallback, useEffect, useRef, useState } from 'react'
import type { RestaurantCandidate } from '../domain/filters'
import { pickRandomItem } from '../domain/random'

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
    setState({ status: 'idle' })
  }, [clearTimer])

  const drawRestaurant = useCallback(() => {
    if (timerRef.current !== undefined) {
      return
    }

    const winner = pickRandomItem(candidates)
    if (!winner) {
      return
    }

    setState({ status: 'drawing' })
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined
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
