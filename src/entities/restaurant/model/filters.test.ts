import { describe, expect, it } from 'vitest'
import type { Restaurant } from './restaurant'
import {
  filterRestaurants,
  getAffordableMenus,
  isMealMenu,
} from './filters'

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

  it('예산 이하더라도 음료, 주류, 추가 메뉴는 제외한다', () => {
    const restaurant: Restaurant = {
      ...restaurants[0],
      id: 'jokbal-with-drinks',
      name: '족발집',
      menus: [
        { name: '소주', price: 4_000 },
        { name: '매화수', price: 5_000 },
        { name: '공기밥', price: 1_000 },
        { name: '라면사리 추가', price: 2_000 },
        { name: '족발(중)', price: 35_000 },
      ],
    }

    expect(getAffordableMenus(restaurant, 10_000)).toEqual([])
  })
})

describe('isMealMenu', () => {
  it.each([
    '소주',
    '생맥주 500cc',
    '콜라',
    '매화수',
    '공기밥',
    '우동사리',
    '치즈 토핑',
    '핫소스',
    '무채 추가',
    '보쌈속(무채)',
  ])('%s는 식사 메뉴로 보지 않는다', (name) => {
    expect(isMealMenu({ name, price: 5_000 })).toBe(false)
  })

  it.each([
    '보쌈정식',
    '비빔밥',
    '와인삼겹살',
    '치킨+생맥주 세트',
    '피자+콜라 세트',
  ])('%s는 음식이 포함된 식사 메뉴로 유지한다', (name) => {
    expect(isMealMenu({ name, price: 10_000 })).toBe(true)
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

  it('저가 메뉴가 주류와 추가 메뉴뿐인 식당은 후보에서 제외한다', () => {
    const result = filterRestaurants(
      [
        {
          ...restaurants[0],
          id: 'expensive-jokbal',
          name: '비싼 족발집',
          menus: [
            { name: '소주', price: 4_000 },
            { name: '공기밥', price: 1_000 },
            { name: '족발 대', price: 40_000 },
          ],
        },
      ],
      {
        userPosition: { latitude: 37, longitude: 127 },
        category: '한식',
        budget: 10_000,
        maxDistanceMeters: 1_000,
      },
    )

    expect(result).toEqual([])
  })
})
