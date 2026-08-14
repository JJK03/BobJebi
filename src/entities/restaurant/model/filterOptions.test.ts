import { describe, expect, it } from 'vitest'
import {
  getTravelRangeSummary,
  getWideTravelRangeLabel,
} from './filterOptions'

describe('filterOptions', () => {
  it('이동 방식별 최대 범위를 화면 문구로 만든다', () => {
    expect(getWideTravelRangeLabel('walking')).toBe('최대 2km')
    expect(getWideTravelRangeLabel('driving')).toBe('최대 20km')
    expect(getTravelRangeSummary()).toBe('도보 2km · 자차 20km')
  })
})
