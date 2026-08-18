import {
  calculateDistanceMeters,
  type Coordinates,
} from '../../../shared/lib/geo'
import {
  ALL_CATEGORY_FILTER,
  type CategoryFilter,
  type Menu,
  type Restaurant,
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

const ACCESSORY_MENU_PATTERN =
  /공기\s*밥|추가\s*밥|밥\s*추가|보쌈\s*속|무채|토핑|사리(?:\s*(?:추가|$)|[(/])|(?:라면|우동|쫄면|당면|칼국수|냉면|떡|치즈)\s*사리/i
const STANDALONE_SAUCE_PATTERN =
  /^(?:추가\s*)?(?:핫|양념|마늘|간장|매운)?\s*소스(?:\s*추가)?$/i
const BEVERAGE_OR_ALCOHOL_PATTERN =
  /소주|맥주|막걸리|동동주|청하|매화수|복분자주?|고량주|와인|하이볼|사케|정종|백세주|산사춘|담금주|오디뽕주|야관문주|콜라(?!겐)|사이다|환타|탄산|음료|생수|주스|쥬스|에이드|커피|아메리카노|카페라떼|스무디/i
const MEAL_SIGNAL_PATTERN =
  /정식|백반|밥|국|탕|찌개|전골|면|국수|냉면|라면|우동|파스타|피자|치킨|족발|보쌈|고기|갈비|삼겹|스테이크|버거|김밥|떡볶이|만두|샐러드|볶음|구이|튀김|전|찜|죽|덮밥|돈가스|돈까스|회|초밥|스시|카레|쌈|수육/i

function normalizeMenuName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function isMealMenu(menu: Menu): boolean {
  const name = normalizeMenuName(menu.name)
  if (!name || ACCESSORY_MENU_PATTERN.test(name)) {
    return false
  }

  if (STANDALONE_SAUCE_PATTERN.test(name)) {
    return false
  }

  return (
    !BEVERAGE_OR_ALCOHOL_PATTERN.test(name) || MEAL_SIGNAL_PATTERN.test(name)
  )
}

export function getAffordableMenus(
  restaurant: Restaurant,
  budget: number,
): Menu[] {
  return restaurant.menus.filter(
    (menu) => isMealMenu(menu) && menu.price <= budget,
  )
}

export function filterRestaurants(
  restaurants: Restaurant[],
  conditions: FilterConditions,
): RestaurantCandidate[] {
  const candidates: RestaurantCandidate[] = []

  for (const restaurant of restaurants) {
    if (
      conditions.category !== ALL_CATEGORY_FILTER &&
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
