import type { Coordinates } from '../../../shared/lib/geo'

export const RESTAURANT_CATEGORIES = [
  '한식',
  '중식',
  '일식',
  '양식',
  '기타요식업',
] as const

export const ALL_CATEGORY_FILTER = '전체' as const

export type RestaurantCategory = (typeof RESTAURANT_CATEGORIES)[number]
export type CategoryFilter = typeof ALL_CATEGORY_FILTER | RestaurantCategory

export interface Menu {
  name: string
  price: number
}

export interface Restaurant extends Coordinates {
  id: string
  name: string
  category: RestaurantCategory
  province: string
  district: string
  phone?: string
  address: string
  menus: Menu[]
  kakaoPlaceId?: string
  kakaoPlaceUrl?: string
}
