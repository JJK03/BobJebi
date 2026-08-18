import { describe, expect, it } from 'vitest'
import {
  CATEGORY_FILTER_OPTIONS,
  getTravelRangeSummary,
  getWideTravelRangeLabel,
} from './filterOptions'

describe('filterOptions', () => {
  it('기타요식업 대신 세분화된 음식 종류를 제공한다', () => {
    expect(CATEGORY_FILTER_OPTIONS).not.toContain('기타요식업')
    expect(CATEGORY_FILTER_OPTIONS).not.toContain('기타 음식점')
    expect(CATEGORY_FILTER_OPTIONS).toEqual(
      expect.arrayContaining([
        '분식·간편식',
        '치킨·피자',
        '베이커리·디저트',
        '샐러드·브런치',
        '뷔페',
        '아시아음식',
        '해산물·회',
        '고기·구이',
        '주점·안주',
      ]),
    )
  })

  it('이동 방식별 최대 범위를 화면 문구로 만든다', () => {
    expect(getWideTravelRangeLabel('walking')).toBe('최대 2km')
    expect(getWideTravelRangeLabel('driving')).toBe('최대 20km')
    expect(getTravelRangeSummary()).toBe('도보 2km · 자차 20km')
  })
})
