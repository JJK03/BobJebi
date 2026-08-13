export const RESTAURANT_CATEGORIES = [
  '한식',
  '중식',
  '일식',
  '양식',
  '기타요식업',
] as const

export type RestaurantCategory = (typeof RESTAURANT_CATEGORIES)[number]
export type CategoryFilter = '전체' | RestaurantCategory

export interface Coordinates {
  latitude: number
  longitude: number
}

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
}
