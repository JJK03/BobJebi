import { calculateDistanceMeters } from './distance'
import type {
  CategoryFilter,
  Coordinates,
  Menu,
  Restaurant,
} from './restaurant'

export interface FilterConditions {
  userPosition: Coordinates
  category: CategoryFilter
  budget: number
  maxDistanceMeters: number
}

export interface RestaurantCandidate {
  restaurant: Restaurant
  distanceMeters: number
  affordableMenus: Menu[]
}

export function getAffordableMenus(
  restaurant: Restaurant,
  budget: number,
): Menu[] {
  return restaurant.menus.filter((menu) => menu.price <= budget)
}

export function filterRestaurants(
  restaurants: Restaurant[],
  conditions: FilterConditions,
): RestaurantCandidate[] {
  const candidates: RestaurantCandidate[] = []

  for (const restaurant of restaurants) {
    if (
      conditions.category !== '전체' &&
      restaurant.category !== conditions.category
    ) {
      continue
    }

    const affordableMenus = getAffordableMenus(
      restaurant,
      conditions.budget,
    )

    if (affordableMenus.length === 0) {
      continue
    }

    const distanceMeters = calculateDistanceMeters(
      conditions.userPosition,
      restaurant,
    )

    if (distanceMeters > conditions.maxDistanceMeters) {
      continue
    }

    candidates.push({ restaurant, distanceMeters, affordableMenus })
  }

  return candidates
}
