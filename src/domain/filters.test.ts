import { describe, expect, it } from 'vitest'
import type { Restaurant } from './restaurant'
import { filterRestaurants, getAffordableMenus } from './filters'

const restaurants: Restaurant[] = [
  {
    id: 'near-korean',
    name: '가까운 한식당',
    category: '한식',
    province: '서울특별시',
    district: '중구',
    address: '서울 중구',
    latitude: 37,
    longitude: 127,
    menus: [
      { name: '비빔밥', price: 8_000 },
      { name: '불고기', price: 15_000 },
    ],
  },
  {
    id: 'far-chinese',
    name: '먼 중식당',
    category: '중식',
    province: '서울특별시',
    district: '중구',
    address: '서울 중구',
    latitude: 37.02,
    longitude: 127,
    menus: [{ name: '짜장면', price: 7_000 }],
  },
]

describe('getAffordableMenus', () => {
  it('예산 이하 메뉴만 반환한다', () => {
    expect(getAffordableMenus(restaurants[0], 10_000)).toEqual([
      { name: '비빔밥', price: 8_000 },
    ])
  })
})

describe('filterRestaurants', () => {
  it('거리, 카테고리, 예산 조건을 모두 적용한다', () => {
    const result = filterRestaurants(restaurants, {
      userPosition: { latitude: 37, longitude: 127 },
      category: '한식',
      budget: 10_000,
      maxDistanceMeters: 1_000,
    })

    expect(result).toHaveLength(1)
    expect(result[0].restaurant.id).toBe('near-korean')
    expect(result[0].affordableMenus).toHaveLength(1)
  })

  it('조건을 만족하는 식당이 없으면 빈 배열을 반환한다', () => {
    const result = filterRestaurants(restaurants, {
      userPosition: { latitude: 37, longitude: 127 },
      category: '일식',
      budget: 5_000,
      maxDistanceMeters: 500,
    })

    expect(result).toEqual([])
  })
})
