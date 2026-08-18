import { describe, expect, it } from 'vitest'
import type { Restaurant } from './restaurant'
import {
  filterRestaurants,
  getAffordableMenus,
  getRestaurantFilterCategory,
  isCafeRestaurant,
  isMealMenu,
  isNonRestaurantBusiness,
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

  it('음식명이 없거나 아동용 가격인 메뉴는 제외한다', () => {
    const restaurant: Restaurant = {
      ...restaurants[0],
      id: 'vague-menu-data',
      menus: [
        { name: '본채', price: 5_000 },
        { name: '1가지 메뉴', price: 8_000 },
        { name: '평일 점심 미취학', price: 9_000 },
        { name: '성인 조식', price: 15_000 },
      ],
    }

    expect(getAffordableMenus(restaurant, 20_000)).toEqual([
      { name: '성인 조식', price: 15_000 },
    ])
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
    '위스키',
    'apple martini',
    'IPA',
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

describe('isCafeRestaurant', () => {
  it('상호와 메뉴가 음료 중심인 순수 카페를 판별한다', () => {
    const cafe: Restaurant = {
      ...restaurants[0],
      id: 'coffee-shop',
      name: '송도 로스터리 카페',
      category: '중식',
      menus: [
        { name: '아메리카노', price: 3_000 },
        { name: '카페라떼', price: 4_000 },
        { name: '캐모마일', price: 4_000 },
      ],
    }

    expect(isCafeRestaurant(cafe)).toBe(true)
  })

  it('커피 로스팅을 뜻하는 볶음은 식사 메뉴로 오인하지 않는다', () => {
    const cafe: Restaurant = {
      ...restaurants[0],
      id: 'coffee-roasting',
      name: '커피볶음',
      menus: [
        { name: '아메리카노', price: 3_000 },
        { name: '카페라떼', price: 4_000 },
      ],
    }

    expect(isCafeRestaurant(cafe)).toBe(true)
  })

  it('전통차와 식혜만 파는 곳도 순수 카페로 판별한다', () => {
    const teaHouse: Restaurant = {
      ...restaurants[0],
      id: 'traditional-tea',
      name: '물안개정원',
      menus: [
        { name: '오미자차', price: 5_000 },
        { name: '수제식혜', price: 4_000 },
      ],
    }

    expect(isCafeRestaurant(teaHouse)).toBe(true)
  })

  it('오장육부약차를 순수 전통차 카페로 판별한다', () => {
    const traditionalTeaCafe: Restaurant = {
      ...restaurants[0],
      id: 'incheon-195854',
      name: '오장육부약차',
      category: '기타요식업',
      kakaoPlaceId: '133941267',
      menus: [
        { name: '제호차', price: 5_000 },
        { name: '헛개나무차', price: 5_000 },
        { name: '계란동동 쌍화차', price: 6_500 },
      ],
    }

    expect(isCafeRestaurant(traditionalTeaCafe)).toBe(true)
  })

  it('동네 이름의 우동은 식사 메뉴로 오인하지 않는다', () => {
    const cafe: Restaurant = {
      ...restaurants[0],
      id: 'seokwoo-cafe',
      name: '석우동카페',
      menus: [{ name: '아메리카노', price: 3_000 }],
    }

    expect(isCafeRestaurant(cafe)).toBe(true)
  })

  it('식사 메뉴가 있는 카페는 식당 후보로 유지한다', () => {
    const brunchCafe: Restaurant = {
      ...restaurants[0],
      id: 'brunch-cafe',
      name: '동네 카페',
      menus: [
        { name: '아메리카노', price: 3_000 },
        { name: '수제 샌드위치', price: 8_000 },
      ],
    }

    expect(isCafeRestaurant(brunchCafe)).toBe(false)
  })

  it('카페 메뉴가 압도적인 더수다는 브런치 일부가 있어도 카페로 판별한다', () => {
    const cafe: Restaurant = {
      ...restaurants[0],
      id: 'incheon-170210',
      name: '더수다',
      category: '중식',
      menus: [
        { name: '아메리카노', price: 2_500 },
        { name: '카페라떼', price: 3_400 },
        { name: '카푸치노', price: 3_400 },
        { name: '허브티', price: 3_900 },
        { name: '카페모카', price: 4_200 },
        { name: '스무디', price: 5_400 },
        { name: '샌드위치', price: 8_900 },
        { name: '수다브런치A', price: 9_800 },
      ],
    }

    expect(isCafeRestaurant(cafe)).toBe(true)
  })

  it('상호가 명백한 식당이면 음료 비율만으로 카페에서 제외하지 않는다', () => {
    const restaurant: Restaurant = {
      ...restaurants[0],
      id: 'meal-business-with-drinks',
      name: '송도국수식당',
      menus: [
        { name: '아메리카노', price: 2_500 },
        { name: '카페라떼', price: 3_400 },
        { name: '허브티', price: 3_900 },
        { name: '잔치국수', price: 7_000 },
      ],
    }

    expect(isCafeRestaurant(restaurant)).toBe(false)
  })

  it('베이커리와 제과점은 카페로 분류하지 않는다', () => {
    const bakery: Restaurant = {
      ...restaurants[0],
      id: 'bakery-cafe',
      name: '쌀빵카페나무',
      menus: [
        { name: '아메리카노', price: 3_000 },
        { name: '소금빵', price: 3_500 },
      ],
    }

    expect(isCafeRestaurant(bakery)).toBe(false)
  })

  it('스타벅스와 띄어 쓴 음료 메뉴를 순수 카페로 판별한다', () => {
    const starbucks: Restaurant = {
      ...restaurants[0],
      id: 'incheon-932371',
      name: '스타벅스 송도트리플R점',
      category: '기타요식업',
      menus: [
        { name: '콜드 브루', price: 4_500 },
        { name: '카페 라떼', price: 4_600 },
        { name: '자몽 허니 블랙 티', price: 5_300 },
        { name: '자바 칩 프라푸치노', price: 6_100 },
      ],
    }

    expect(isCafeRestaurant(starbucks)).toBe(true)
  })
})

describe('getRestaurantFilterCategory', () => {
  it('자바 칩의 바를 주점 bar로 오인하지 않는다', () => {
    expect(
      getRestaurantFilterCategory({
        ...restaurants[0],
        id: 'java-chip-cafe',
        name: '이름없는커피매장',
        category: '기타요식업',
        menus: [{ name: '자바 칩 프라푸치노', price: 6_100 }],
      }),
    ).toBeNull()
  })

  it.each([
    ['16630201', '추억의포장마차', '계란말이', '주점·안주'],
    [
      '24481763',
      '파리바게뜨 송도센트럴파크점',
      '소금빵',
      '베이커리·디저트',
    ],
    ['1422120170', '흥성양꼬치 송도점', '숙성 생양꼬치', '아시아음식'],
  ])(
    '카카오 장소 ID %s로 확인된 %s의 원본 오분류만 보정한다',
    (kakaoPlaceId, name, menuName, expected) => {
      expect(
        getRestaurantFilterCategory({
          ...restaurants[0],
          id: `source-category-override-${name}`,
          kakaoPlaceId,
          name,
          category: '중식',
          menus: [{ name: menuName, price: 10_000 }],
        }),
      ).toBe(expected)
    },
  )

  it('개별 보정되지 않은 상호명은 원본 분류보다 우선하지 않는다', () => {
    expect(
      getRestaurantFilterCategory({
        ...restaurants[0],
        id: 'uncurated-source-category',
        name: '이름만 포차인 식당',
        category: '한식',
        menus: [{ name: '계란말이', price: 10_000 }],
      }),
    ).toBe('한식')
  })

  it('강한 반대 신호가 없는 정상 중식은 원본 분류를 유지한다', () => {
    expect(
      getRestaurantFilterCategory({
        ...restaurants[0],
        id: 'source-category-chinese',
        name: '레인보우차이홍',
        category: '중식',
        menus: [{ name: '유니자장면', price: 8_000 }],
      }),
    ).toBe('중식')
  })

  it.each([
    ['김밥마을', '참치김밥', '분식·간편식'],
    ['박은선닭꼬치', '순살닭꼬치', '분식·간편식'],
    ['만두의정석', '고기만두', '분식·간편식'],
    ['리오브리또', '브리또', '분식·간편식'],
    ['옛날통닭', '후라이드치킨', '치킨·피자'],
    ['토리베이커리', '소금빵', '베이커리·디저트'],
    ['꼼빠도르', '팥빵', '베이커리·디저트'],
    ['이가떡방', '떡 1팩', '베이커리·디저트'],
    ['복래춘', '월병', '베이커리·디저트'],
    ['스윗샐러드', '닭가슴살샐러드', '샐러드·브런치'],
    ['행복뷔페', '점심 뷔페', '뷔페'],
    ['라마다송도호텔', '성인 조식', '뷔페'],
    ['사이공키친', '소고기쌀국수', '아시아음식'],
    ['전원일기', '마제소바', '일식'],
    ['참숯불꼼장어', '꼼장어 1인분', '해산물·회'],
    ['숲풀림곱창', '모둠곱창', '고기·구이'],
    ['국민먹태', '바삭먹태', '주점·안주'],
    ['호주가', 'IPA', '주점·안주'],
    ['이름없는가게', '오늘의 메뉴', null],
  ])('%s을(를) %s 메뉴로 %s에 분류한다', (name, menuName, expected) => {
    const restaurant: Restaurant = {
      ...restaurants[0],
      id: `${name}-${menuName}`,
      name,
      category: '기타요식업',
      menus: [{ name: menuName, price: 9_000 }],
    }

    expect(getRestaurantFilterCategory(restaurant)).toBe(expected)
  })

  it('기존 한식, 중식, 일식, 양식 분류는 그대로 유지한다', () => {
    expect(getRestaurantFilterCategory(restaurants[0])).toBe('한식')
    expect(getRestaurantFilterCategory(restaurants[1])).toBe('중식')
  })

  it.each([
    ['크러스트', '1136047260', '베이커리·디저트'],
    ['까르본', '10199351', '아시아음식'],
  ])('%s의 검증된 카카오 장소를 올바른 음식 종류로 분류한다', (
    name,
    kakaoPlaceId,
    expected,
  ) => {
    expect(
      getRestaurantFilterCategory({
        ...restaurants[0],
        id: kakaoPlaceId,
        name,
        category: '기타요식업',
        kakaoPlaceId,
        menus: [{ name: '세트 메뉴', price: 20_000 }],
      }),
    ).toBe(expected)
  })
})

describe('isNonRestaurantBusiness', () => {
  it.each([
    '영풍축산물판매장',
    '동네정육점',
    '착한김치',
    '우리반찬가게',
    '해인식품',
    '협동조합 먹을거리',
  ])('%s은 식당이 아닌 식품 판매점으로 판별한다', (name) => {
    expect(
      isNonRestaurantBusiness({
        ...restaurants[0],
        id: name,
        name,
      }),
    ).toBe(true)
  })

  it('김치찌개 식당은 판매점으로 제외하지 않는다', () => {
    expect(
      isNonRestaurantBusiness({
        ...restaurants[0],
        id: 'kimchi-stew',
        name: '착한김치찌개집',
      }),
    ).toBe(false)
  })

  it('장류와 포장 원두가 메뉴 대부분이면 판매점으로 판별한다', () => {
    expect(
      isNonRestaurantBusiness({
        ...restaurants[0],
        id: 'traditional-products',
        name: '온유두담',
        menus: [
          { name: '콩탕 1kg', price: 8_000 },
          { name: '전통찹쌀고추장 500g', price: 25_000 },
          { name: '강원도막장 800g', price: 30_000 },
        ],
      }),
    ).toBe(true)

    expect(
      isNonRestaurantBusiness({
        ...restaurants[0],
        id: 'coffee-bean-store',
        name: '어울림',
        menus: [
          { name: '콜롬비아 원두 100g', price: 3_000 },
          { name: '블렌딩 원두 100g', price: 3_600 },
        ],
      }),
    ).toBe(true)
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

  it('카테고리가 잘못 지정된 순수 카페도 식당 후보에서 제외한다', () => {
    const result = filterRestaurants(
      [
        {
          ...restaurants[0],
          id: 'misclassified-cafe',
          name: '커피하우스',
          category: '중식',
          menus: [
            { name: '아메리카노', price: 2_500 },
            { name: '카페라떼', price: 3_500 },
          ],
        },
      ],
      {
        userPosition: { latitude: 37, longitude: 127 },
        category: '중식',
        budget: 10_000,
        maxDistanceMeters: 1_000,
      },
    )

    expect(result).toEqual([])
  })

  it('기타요식업의 세부 카테고리로 후보를 필터링한다', () => {
    const result = filterRestaurants(
      [
        {
          ...restaurants[0],
          id: 'quick-meal',
          name: '착한김밥',
          category: '기타요식업',
          menus: [{ name: '참치김밥', price: 5_000 }],
        },
        {
          ...restaurants[0],
          id: 'pizza-shop',
          name: '착한피자',
          category: '기타요식업',
          menus: [{ name: '치즈피자', price: 9_000 }],
        },
      ],
      {
        userPosition: { latitude: 37, longitude: 127 },
        category: '분식·간편식',
        budget: 10_000,
        maxDistanceMeters: 1_000,
      },
    )

    expect(result).toHaveLength(1)
    expect(result[0].restaurant.id).toBe('quick-meal')
    expect(result[0].category).toBe('분식·간편식')
  })

  it('식품 판매점은 예산에 맞는 품목이 있어도 후보에서 제외한다', () => {
    const result = filterRestaurants(
      [
        {
          ...restaurants[0],
          id: 'meat-store',
          name: '영풍축산물판매장',
          category: '기타요식업',
          menus: [{ name: '삼겹살 100g', price: 3_000 }],
        },
      ],
      {
        userPosition: { latitude: 37, longitude: 127 },
        category: '전체',
        budget: 10_000,
        maxDistanceMeters: 1_000,
      },
    )

    expect(result).toEqual([])
  })

  it('세부 분류를 확인할 수 없는 기타 음식점은 전체 후보에서도 제외한다', () => {
    const result = filterRestaurants(
      [
        {
          ...restaurants[0],
          id: 'unclassified-restaurant',
          name: '이름없는가게',
          category: '기타요식업',
          menus: [{ name: '오늘의 메뉴', price: 9_000 }],
        },
      ],
      {
        userPosition: { latitude: 37, longitude: 127 },
        category: '전체',
        budget: 10_000,
        maxDistanceMeters: 1_000,
      },
    )

    expect(result).toEqual([])
  })
})
