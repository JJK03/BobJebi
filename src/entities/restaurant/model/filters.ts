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
const CAFE_NAME_PATTERN =
  /카페|커피숍|커피|다방|cafe|coffee|로스터리|로스터스/i
const BAKERY_NAME_PATTERN =
  /베이커리|제과|제빵|빵집|브레드|도넛|bakery|쌀빵/i
const CAFE_MENU_PATTERN =
  /아메리카노|에스프레소|카페라떼|카푸치노|마끼아또|콜드브루|더치커피|핸드드립|커피|라떼|스무디|에이드|아이스티|허브티|캐모마일|페퍼민트|얼그레이|루이보스|녹차|홍차|밀크티|주스|쥬스/i
const SUBSTANTIAL_MEAL_PATTERN =
  /분식|정식|백반|비빔밥|볶음밥|덮밥|국밥|김밥|국수|냉면|라면|우동|파스타|피자|치킨|족발|보쌈|고기|갈비|삼겹|스테이크|버거|떡볶이|만두|샌드위치|샐러드|브런치|찌개|전골|곰탕|설렁탕|칼국수|수제비|돈가스|돈까스|초밥|스시|카레|수육|토스트|핫도그|오믈렛|해물파전|김치전|파전|부추전|감자전|튀김|구이|볶음|찜/i

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

export function isCafeRestaurant(restaurant: Restaurant): boolean {
  const restaurantName = normalizeMenuName(restaurant.name)
  if (BAKERY_NAME_PATTERN.test(restaurantName)) {
    return false
  }

  const hasSubstantialMeal =
    SUBSTANTIAL_MEAL_PATTERN.test(restaurantName) ||
    restaurant.menus.some((menu) =>
      SUBSTANTIAL_MEAL_PATTERN.test(normalizeMenuName(menu.name)),
    )
  if (hasSubstantialMeal) {
    return false
  }

  if (CAFE_NAME_PATTERN.test(restaurantName)) {
    return true
  }

  const cafeMenuCount = restaurant.menus.filter((menu) =>
    CAFE_MENU_PATTERN.test(normalizeMenuName(menu.name)),
  ).length

  return (
    restaurant.menus.length > 0 &&
    cafeMenuCount / restaurant.menus.length >= 0.5
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
    if (isCafeRestaurant(restaurant)) {
      continue
    }

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
