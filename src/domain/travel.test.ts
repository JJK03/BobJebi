import { describe, expect, it } from 'vitest'
import {
  estimateTravelTimeMinutes,
  getTravelDistanceLimitMeters,
} from './travel'

describe('getTravelDistanceLimitMeters', () => {
  it('도보와 자차의 예상 이동 거리 한도를 다르게 계산한다', () => {
    expect(getTravelDistanceLimitMeters('walking', 10)).toBeCloseTo(666.67, 1)
    expect(getTravelDistanceLimitMeters('driving', 10)).toBe(4_000)
  })

  it('넓게 보기는 이동 방식별 최대 범위를 적용한다', () => {
    expect(getTravelDistanceLimitMeters('walking', 'wide')).toBe(2_000)
    expect(getTravelDistanceLimitMeters('driving', 'wide')).toBe(20_000)
  })
})

describe('estimateTravelTimeMinutes', () => {
  it('직선거리를 선택한 이동 방식의 예상 분으로 변환한다', () => {
    expect(estimateTravelTimeMinutes(1_000, 'walking')).toBe(15)
    expect(estimateTravelTimeMinutes(1_000, 'driving')).toBe(3)
  })
})
