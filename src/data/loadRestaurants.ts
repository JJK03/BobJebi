import {
  RESTAURANT_CATEGORIES,
  type Restaurant,
  type RestaurantCategory,
} from '../domain/restaurant'
import {
  RESTAURANT_SOURCES,
  type RestaurantSource,
} from '../domain/restaurantSource'

const categorySet = new Set<string>(RESTAURANT_CATEGORIES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRestaurant(value: unknown): value is Restaurant {
  if (!isRecord(value) || !Array.isArray(value.menus)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    categorySet.has(value.category as RestaurantCategory) &&
    typeof value.province === 'string' &&
    typeof value.district === 'string' &&
    typeof value.address === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    (value.kakaoPlaceId === undefined ||
      typeof value.kakaoPlaceId === 'string') &&
    (value.kakaoPlaceUrl === undefined ||
      typeof value.kakaoPlaceUrl === 'string') &&
    value.menus.length > 0 &&
    value.menus.every(
      (menu) =>
        isRecord(menu) &&
        typeof menu.name === 'string' &&
        typeof menu.price === 'number',
    )
  )
}

export async function loadRestaurants(
  source: RestaurantSource,
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const response = await fetch(RESTAURANT_SOURCES[source].dataPath, { signal })

  if (!response.ok) {
    throw new Error(`식당 데이터를 불러오지 못했습니다. (${response.status})`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data) || !data.every(isRestaurant)) {
    throw new Error('식당 데이터 형식이 올바르지 않습니다.')
  }

  return data
}
