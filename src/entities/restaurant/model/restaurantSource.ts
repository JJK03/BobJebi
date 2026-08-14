export const RESTAURANT_SOURCES = {
  "good-price": {
    tabLabel: "착한가격업소",
    headerLabel: "전국 착한가격업소에서 골라요",
    kicker: "가까운 곳에서 · 예산 안에서",
    description: "위치와 조건을 고르면 가까운 착한가격 식당 중",
    ticketLabel: "GOOD PRICE",
    loadingLabel: "전국 착한가격업소 데이터를 불러오는 중입니다…",
    footerLabel:
      "행정안전부 착한가격업소 데이터를 활용한 위치 기반 추천 서비스",
    dataPath: "/data/restaurants.json",
  },
  "incheon-smart-food": {
    tabLabel: "인천 스마트음식관광",
    headerLabel: "인천의 다양한 식당에서 골라요",
    kicker: "인천 곳곳에서 · 메뉴 가격 안에서",
    description: "위치와 조건을 고르면 인천 스마트음식관광 식당 중",
    ticketLabel: "INCHEON FOOD",
    loadingLabel: "인천 스마트음식관광 데이터를 불러오는 중입니다…",
    footerLabel:
      "인천관광공사 스마트음식관광 DB를 활용한 위치 기반 추천 서비스",
    dataPath: "/data/incheon-restaurants.json",
  },
} as const;

export type RestaurantSource = keyof typeof RESTAURANT_SOURCES;
