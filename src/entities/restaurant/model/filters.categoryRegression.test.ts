import { describe, expect, it } from 'vitest'
import { CATEGORY_REGRESSION_FIXTURES } from './categoryRegressionFixtures'
import { getRestaurantFilterCategory } from './filters'
import type { Restaurant } from './restaurant'

describe('실제 데이터 카테고리 회귀 표본', () => {
  it.each(CATEGORY_REGRESSION_FIXTURES)(
    '$source/$id $name → $expectedCategory',
    ({ id, kakaoPlaceId, name, menuNames, expectedCategory }) => {
      const restaurant: Restaurant = {
        id,
        kakaoPlaceId,
        name,
        category: '기타요식업',
        province: '회귀 테스트',
        district: '회귀 테스트',
        address: '회귀 테스트',
        latitude: 0,
        longitude: 0,
        menus: menuNames.map((menuName) => ({
          name: menuName,
          price: 10_000,
        })),
      }

      expect(getRestaurantFilterCategory(restaurant)).toBe(expectedCategory)
    },
  )
})
