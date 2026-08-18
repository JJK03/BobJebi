import {
  calculateDistanceMeters,
  type Coordinates,
} from '../../../shared/lib/geo'
import {
  ALL_CATEGORY_FILTER,
  type CategoryFilter,
  type Menu,
  type Restaurant,
  type RestaurantFilterCategory,
} from './restaurant'

export interface FilterConditions {
  userPosition: Coordinates
  category: CategoryFilter
  budget: number
  maxDistanceMeters: number
}

export interface RestaurantCandidate {
  restaurant: Restaurant
  category: RestaurantFilterCategory
  distanceMeters: number
  affordableMenus: Menu[]
}

const ACCESSORY_MENU_PATTERN =
  /공기\s*밥|추가\s*밥|밥\s*추가|보쌈\s*속|무채|토핑|사리(?:\s*(?:추가|$)|[(/])|(?:라면|우동|쫄면|당면|칼국수|냉면|떡|치즈)\s*사리/i
const VAGUE_OR_CHILD_MENU_PATTERN =
  /유아|미취학|초등학생|소인|^(?:본채|바다|오늘의 메뉴|점심특선메뉴|탕종류|\d+\s*가지 메뉴|\d+\s*~\s*\d+)$/i
const STANDALONE_SAUCE_PATTERN =
  /^(?:추가\s*)?(?:핫|양념|마늘|간장|매운)?\s*소스(?:\s*추가)?$/i
const BEVERAGE_OR_ALCOHOL_PATTERN =
  /소주|맥주|막걸리|동동주|청하|매화수|복분자주?|고량주|와인|하이볼|사케|정종|전통주|백세주|산사춘|담금주|오디뽕주|야관문주|칵테일|위스키|whisk(?:y|ey)|보드카|vodka|양주|데킬라|테킬라|tequila|martini|mai tai|beer|비어|스타우트|에일|\bipa\b|콜라(?!겐)|사이다|환타|탄산|음료|생수|주스|쥬스|에이드|커피|아메리카노|카페라떼|스무디|식혜/i
const MEAL_SIGNAL_PATTERN =
  /정식|백반|밥|국|탕|찌개|전골|면|국수|냉면|라면|우동|파스타|피자|치킨|족발|보쌈|고기|갈비|삼겹|스테이크|버거|김밥|떡볶이|만두|샐러드|볶음|구이|튀김|파전|김치전|해물전|부추전|감자전|빈대떡|찜|죽|덮밥|돈가스|돈까스|회|초밥|스시|카레|쌈|수육/i
const CAFE_NAME_PATTERN =
  /카페|커피숍|커피|다방|찻집|약차|티룸|cafe|coffee|로스터리|로스터스|스타벅스|투썸플레이스|이디야|폴바셋|할리스|탐앤탐스|커피빈|엔제리너스/i
const BAKERY_NAME_PATTERN =
  /베이커리|제과|제빵|빵집|브레드|도넛|bakery|쌀빵/i
const CAFE_MENU_PATTERN =
  /아메리카노|에스프레소|카페\s*라떼|카페\s*모카|카푸치노|마끼아또|마키아또|콜드\s*브루|더치\s*커피|핸드\s*드립|커피|라떼|스무디|에이드|아이스\s*티|허브\s*티|블랙\s*티|캐모마일|페퍼민트|얼그레이|루이보스|녹차|홍차|밀크\s*티|프라푸치노|블렌디드|주스|쥬스|대추차|유자차|생강차|쌍화차|한방차|전통차|오미자차|수제차|미숫가루|식혜|핫초코/i
const SUBSTANTIAL_MEAL_PATTERN =
  /분식|정식|백반|비빔밥|볶음밥|덮밥|국밥|김밥|국수|냉면|라면|우동|파스타|피자|치킨|족발|보쌈|고기|갈비|삼겹|스테이크|버거|떡볶이|만두|샌드위치|샐러드|브런치|찌개|전골|곰탕|설렁탕|칼국수|수제비|돈가스|돈까스|초밥|스시|카레|수육|토스트|핫도그|오믈렛|해물파전|김치전|파전|부추전|감자전|튀김|구이|볶음|찜/i
const SUBSTANTIAL_BUSINESS_NAME_PATTERN =
  /분식|식당|정식|백반|국밥|김밥|국수|냉면|라면|파스타|피자|치킨|족발|보쌈|고깃집|고기집|갈비|스테이크|버거|떡볶이|만두|샌드위치|샐러드|브런치|찌개|전골|칼국수|수제비|돈가스|돈까스|초밥|스시|카레|수육|토스트|핫도그/i
const SALAD_OR_BRUNCH_PATTERN = /샐러드|브런치|샌드위치|sandwich|산도/i
const CHICKEN_OR_PIZZA_PATTERN =
  /치킨|통닭|닭강정|피자|햄버거|버거|프라이드치킨/i
const QUICK_MEAL_PATTERN =
  /분식|김밥|떡볶이|순대(?!국)|어묵|오뎅|라볶이|토스트|핫도그|닭꼬치|떡꼬치|만두|브리또|부리또|전복죽|야채죽|소고기죽/i
const BAKERY_OR_DESSERT_PATTERN =
  /베이커리|베이크|베이킹|제과|제빵|과자점|과자|빵집|빵|브레드|bread|베이글|bagel|도넛|도너츠|도너트|bakery|크루아상|크로와상|croissant|꽈배기|찐빵|호떡|붕어빵|고로케|마카롱|케이크|케익|cake|와플|크로플|아이스크림|빙수|젤라또|디저트|쿠키|cookie|휘낭시에|스콘|타르트|tart|카스테라|카스텔라|호두과자|호도|푸딩|츄러스|브라우니|brownie|파이|pie|머핀|muffin|만주|월병|다쿠와즈|모찌|인절미|백설기|절편|개떡|약식|강정|오란다|정과|한과|팥죽|호박죽|떡방|떡집|떡(?!볶이|갈비|만두)/i
const BUFFET_PATTERN = /뷔페|부페|buffet/i
const BUFFET_OR_EVENT_PATTERN =
  /호텔|파티하우스|파티|조식|미취학|소인|대인|무한리필/i
const ASIAN_FOOD_PATTERN =
  /쌀국수|마라|샤브|월남쌈|타코|케밥|팟타이|나시고랭|인도커리|똠얌|반미/i
const JAPANESE_FOOD_PATTERN =
  /마제소바|초밥|스시|우동|카레|돈가스|돈까스|돈카츠/i
const SEAFOOD_PATTERN =
  /꼼장어|곰장어|장어|횟집|모듬회|생선회|회덮밥|사시미|광어|우럭|연어|참치|낙지|오징어|주꾸미|쭈꾸미|문어|조개|굴|해물|아귀|복어|대게|꽃게|게장|새우|골뱅이|과메기|생선/i
const MEAT_OR_GRILL_PATTERN =
  /곱창|막창|대창|고깃집|고기집|숯불|직화|삼겹|갈비|불고기|육회|닭갈비|오리|바비큐|바베큐|스테이크|제육|두루치기|돼지껍데기/i
const PUB_OR_SNACK_PATTERN =
  /포차|호프|주점|펍|pub|술집|먹태|노가리|짝태|이자카야|오뎅바|막걸리|칵테일|위스키|whisk(?:y|ey)|보드카|vodka|양주|beer|비어|스타우트|에일|\bipa\b|martini|tequila|안주|빈대떡|모듬전/i
const BAKERY_OR_DESSERT_BUSINESS_PATTERN =
  /베이커리|베이크|베이킹|제과|제빵|과자점|빵집|브레드|베이글|도넛|도너츠|도너트|bakery|파리바게뜨|파리바게트|뚜레쥬르|설빙|떡방|떡집/i
const ASIAN_FOOD_BUSINESS_PATTERN =
  /쌀국수|마라|훠궈|양꼬치|샤브|월남쌈|타코|케밥|팟타이|나시고랭|인도커리|인디아|사이공|똠얌|반미/i
const PUB_OR_SNACK_BUSINESS_PATTERN =
  /포장마차|포차|호프|주점|펍|pub|술집|맥주집|비어|이자카야|오뎅바|주막/i
const NON_RESTAURANT_BUSINESS_PATTERN =
  /축산물|정육점|정육마트|반찬가게|반찬점|식품(?:판매장)?|김치(?:가게|판매|$)|먹을거리|계란$/i
const RETAIL_PRODUCT_PATTERN =
  /고추장|된장|막장|김치\s*\(?\d+(?:\.\d+)?\s*kg|원두\s*\d+\s*g/i

const CURATED_FILTER_CATEGORY_BY_KAKAO_PLACE_ID: Readonly<
  Partial<Record<string, RestaurantFilterCategory>>
> = {
  '1136047260': '베이커리·디저트', // 크러스트
  '10199351': '아시아음식', // 까르본: 우즈베키스탄 음식 전문점
  '13657074': '주점·안주', // 트라이포트: 위스키·주류 전문점
}

type CategoryPatternRule = readonly [
  RestaurantFilterCategory,
  RegExp,
]

const STRONG_BUSINESS_CATEGORY_RULES: readonly CategoryPatternRule[] = [
  ['뷔페', BUFFET_PATTERN],
  ['베이커리·디저트', BAKERY_OR_DESSERT_BUSINESS_PATTERN],
  ['아시아음식', ASIAN_FOOD_BUSINESS_PATTERN],
  ['일식', JAPANESE_FOOD_PATTERN],
  ['주점·안주', PUB_OR_SNACK_BUSINESS_PATTERN],
  ['해산물·회', SEAFOOD_PATTERN],
  ['샐러드·브런치', SALAD_OR_BRUNCH_PATTERN],
  ['치킨·피자', CHICKEN_OR_PIZZA_PATTERN],
  ['분식·간편식', QUICK_MEAL_PATTERN],
  ['고기·구이', MEAT_OR_GRILL_PATTERN],
]

const MENU_CATEGORY_RULES: readonly CategoryPatternRule[] = [
  ['아시아음식', ASIAN_FOOD_PATTERN],
  ['일식', JAPANESE_FOOD_PATTERN],
  ['샐러드·브런치', SALAD_OR_BRUNCH_PATTERN],
  ['치킨·피자', CHICKEN_OR_PIZZA_PATTERN],
  ['분식·간편식', QUICK_MEAL_PATTERN],
  ['베이커리·디저트', BAKERY_OR_DESSERT_PATTERN],
  ['뷔페', BUFFET_PATTERN],
  ['뷔페', BUFFET_OR_EVENT_PATTERN],
  ['주점·안주', PUB_OR_SNACK_PATTERN],
  ['해산물·회', SEAFOOD_PATTERN],
  ['고기·구이', MEAT_OR_GRILL_PATTERN],
]

function normalizeMenuName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

function getMatchingCategory(
  text: string,
  rules: readonly CategoryPatternRule[],
): RestaurantFilterCategory | null {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null
}

export function isMealMenu(menu: Menu): boolean {
  const name = normalizeMenuName(menu.name)
  if (
    !name ||
    ACCESSORY_MENU_PATTERN.test(name) ||
    VAGUE_OR_CHILD_MENU_PATTERN.test(name)
  ) {
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

  const normalizedMenuNames = restaurant.menus.map((menu) =>
    normalizeMenuName(menu.name),
  )
  const cafeMenuCount = normalizedMenuNames.filter((name) =>
    CAFE_MENU_PATTERN.test(name),
  ).length
  const substantialMealCount = normalizedMenuNames.filter((name) =>
    SUBSTANTIAL_MEAL_PATTERN.test(name),
  ).length
  const menuCount = normalizedMenuNames.length
  const hasSubstantialBusinessName =
    SUBSTANTIAL_BUSINESS_NAME_PATTERN.test(restaurantName)
  const isCafeDominant =
    !hasSubstantialBusinessName &&
    menuCount > 0 &&
    cafeMenuCount / menuCount >= 0.5 &&
    substantialMealCount / menuCount <= 0.25

  if (isCafeDominant) {
    return true
  }

  const hasSubstantialMeal =
    hasSubstantialBusinessName || substantialMealCount > 0
  if (hasSubstantialMeal) {
    return false
  }

  if (CAFE_NAME_PATTERN.test(restaurantName)) {
    return true
  }

  return menuCount > 0 && cafeMenuCount / menuCount >= 0.5
}

export function isNonRestaurantBusiness(restaurant: Restaurant): boolean {
  if (
    NON_RESTAURANT_BUSINESS_PATTERN.test(normalizeMenuName(restaurant.name))
  ) {
    return true
  }

  const retailMenuCount = restaurant.menus.filter((menu) =>
    RETAIL_PRODUCT_PATTERN.test(normalizeMenuName(menu.name)),
  ).length
  return (
    restaurant.menus.length > 0 &&
    retailMenuCount / restaurant.menus.length >= 0.5
  )
}

export function getRestaurantFilterCategory(
  restaurant: Restaurant,
): RestaurantFilterCategory | null {
  const curatedCategory = restaurant.kakaoPlaceId
    ? CURATED_FILTER_CATEGORY_BY_KAKAO_PLACE_ID[restaurant.kakaoPlaceId]
    : undefined
  if (curatedCategory) {
    return curatedCategory
  }

  const restaurantName = normalizeMenuName(restaurant.name)
  const businessCategory = getMatchingCategory(
    restaurantName,
    STRONG_BUSINESS_CATEGORY_RULES,
  )
  if (businessCategory) {
    return businessCategory
  }

  if (restaurant.category !== '기타요식업') {
    return restaurant.category
  }

  const menuText = normalizeMenuName(
    restaurant.menus.map((menu) => menu.name).join(' '),
  )
  return getMatchingCategory(menuText, MENU_CATEGORY_RULES)
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
      isCafeRestaurant(restaurant) ||
      isNonRestaurantBusiness(restaurant)
    ) {
      continue
    }

    const restaurantCategory = getRestaurantFilterCategory(restaurant)
    if (restaurantCategory === null) {
      continue
    }

    if (
      conditions.category !== ALL_CATEGORY_FILTER &&
      restaurantCategory !== conditions.category
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

    candidates.push({
      restaurant,
      category: restaurantCategory,
      distanceMeters,
      affordableMenus,
    })
  }

  return candidates
}
