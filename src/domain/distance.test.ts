import { describe, expect, it } from 'vitest'
import { calculateDistanceMeters } from './distance'

describe('calculateDistanceMeters', () => {
  it('같은 좌표의 거리는 0이다', () => {
    const point = { latitude: 37.5665, longitude: 126.978 }
    expect(calculateDistanceMeters(point, point)).toBe(0)
  })

  it('위도 약 0.009도 차이를 약 1km로 계산한다', () => {
    const distance = calculateDistanceMeters(
      { latitude: 37, longitude: 127 },
      { latitude: 37.009, longitude: 127 },
    )

    expect(distance).toBeGreaterThan(990)
    expect(distance).toBeLessThan(1_010)
  })
})
