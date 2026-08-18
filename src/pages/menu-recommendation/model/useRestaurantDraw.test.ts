// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
  type RenderHookResult,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RestaurantCandidate } from '../../../entities/restaurant'
import { useRestaurantDraw } from './useRestaurantDraw'

const candidates: RestaurantCandidate[] = ['첫 번째', '두 번째', '세 번째'].map(
  (name, index) => ({
    restaurant: {
      id: `restaurant-${index}`,
      name,
      category: '한식',
      province: '인천광역시',
      district: '연수구',
      address: `인천 연수구 식당로 ${index + 1}`,
      latitude: 37.39,
      longitude: 126.64,
      menus: [{ name: '백반', price: 9_000 }],
    },
    category: '한식',
    distanceMeters: 100,
    affordableMenus: [{ name: '백반', price: 9_000 }],
  }),
)

function completeDraw(
  result: RenderHookResult<ReturnType<typeof useRestaurantDraw>, unknown>,
) {
  act(() => result.result.current.drawRestaurant())
  act(() => vi.advanceTimersByTime(1_800))
  return result.result.current.selected?.restaurant.name
}

describe('중복 없는 제비뽑기', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('모든 후보를 한 번씩 뽑기 전에는 같은 식당을 다시 뽑지 않는다', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = renderHook(() => useRestaurantDraw(candidates))

    expect(completeDraw(result)).toBe('첫 번째')
    expect(completeDraw(result)).toBe('두 번째')
    expect(completeDraw(result)).toBe('세 번째')
  })

  it('새 회차가 시작돼도 직전 식당은 연속으로 나오지 않는다', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = renderHook(() => useRestaurantDraw(candidates))

    completeDraw(result)
    completeDraw(result)
    expect(completeDraw(result)).toBe('세 번째')
    expect(completeDraw(result)).toBe('첫 번째')
  })

  it('조건 변경으로 결과를 지우면 추첨 기록도 초기화한다', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = renderHook(() => useRestaurantDraw(candidates))

    expect(completeDraw(result)).toBe('첫 번째')
    act(() => result.result.current.clearResult())
    expect(completeDraw(result)).toBe('첫 번째')
  })
})
