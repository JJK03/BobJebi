import { describe, expect, it } from "vitest";
import {
  auditRestaurantDataset,
  findDuplicateGroups,
  getSideMenuSuspicion,
  normalizeRestaurantAddress,
  normalizeRestaurantName,
  suggestRestaurantCategory,
} from "./audit-restaurant-data.mjs";

const createRestaurant = (overrides = {}) => ({
  id: "restaurant-1",
  name: "행복 식당",
  category: "한식",
  address: "인천광역시 연수구 행복로 1",
  latitude: 37.4,
  longitude: 126.6,
  menus: [{ name: "김치찌개", price: 8_000 }],
  ...overrides,
});

describe("식당 식별값 정규화", () => {
  it("회사 표기와 공백을 제거해 상호명을 비교한다", () => {
    expect(normalizeRestaurantName("(주) 행복-식당")).toBe("행복식당");
  });

  it("주소의 공백과 문장부호를 제거한다", () => {
    expect(normalizeRestaurantAddress("인천 연수구 행복로 1-2")).toBe(
      "인천연수구행복로12",
    );
  });
});

describe("중복 그룹 탐지", () => {
  it("같은 키가 두 번 이상인 식당만 상세 목록으로 반환한다", () => {
    const groups = findDuplicateGroups(
      [
        createRestaurant({ id: "a", kakaoPlaceId: "100" }),
        createRestaurant({ id: "b", kakaoPlaceId: "100" }),
        createRestaurant({ id: "c", kakaoPlaceId: "200" }),
      ],
      (restaurant) => restaurant.kakaoPlaceId,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "100", count: 2 });
    expect(groups[0].restaurants.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});

describe("저가 사이드 메뉴 의심 판정", () => {
  it.each(["후식 볶음밥", "볶음밥 추가", "상차림비", "밥 리필", "메뉴 변경비"])(
    "%s을 검토 대상으로 찾는다",
    (name) => {
      expect(getSideMenuSuspicion({ name, price: 5_000 })).toBeDefined();
    },
  );

  it("일반 김치볶음밥은 사이드 메뉴로 의심하지 않는다", () => {
    expect(
      getSideMenuSuspicion({ name: "김치볶음밥", price: 7_000 }),
    ).toBeUndefined();
  });

  it.each(["한상차림", "직화제육 한상차림", "그날그날 특별한 한상차림"])(
    "%s은 식사 메뉴로 유지한다",
    (name) => {
      expect(getSideMenuSuspicion({ name, price: 9_000 })).toBeUndefined();
    },
  );

  it("설정한 가격보다 비싼 항목은 저가 의심 목록에서 제외한다", () => {
    expect(
      getSideMenuSuspicion({ name: "후식 볶음밥", price: 12_000 }, 10_000),
    ).toBeUndefined();
  });
});

describe("카테고리 검토 제안", () => {
  it("상호명과 메뉴의 강한 신호로 검토 카테고리를 제안한다", () => {
    expect(
      suggestRestaurantCategory(
        createRestaurant({ name: "송도초밥", menus: [{ name: "모듬스시", price: 15_000 }] }),
      ),
    ).toMatchObject({ category: "일식" });
  });
});

describe("데이터셋 감사", () => {
  it("원본을 변경하지 않고 요약과 상세 목록을 만든다", () => {
    const restaurants = [
      createRestaurant({
        id: "a",
        kakaoPlaceId: "100",
        placeVerification: {
          provider: "kakao",
          status: "confirmed",
          matchedBy: "name-address",
          distanceMeters: 10,
          checkedAt: "2026-08-18T00:00:00.000Z",
        },
        menus: [{ name: "상차림비", price: 3_000 }],
      }),
      createRestaurant({
        id: "b",
        kakaoPlaceId: "100",
        menus: [{ name: "김치찌개", price: 8_000 }],
      }),
      createRestaurant({
        id: "c",
        name: "동네피자",
        category: "기타요식업",
        address: "인천광역시 연수구 다른로 2",
        menus: [{ name: "치즈피자", price: 15_000 }],
      }),
    ];
    const before = structuredClone(restaurants);

    const result = auditRestaurantDataset(
      "good-price",
      "restaurants.json",
      restaurants,
    );

    expect(result.summary).toMatchObject({
      totalRestaurants: 3,
      kakaoPlaceIdRestaurants: 2,
      kakaoConfirmedRestaurants: 1,
      kakaoUnconfirmedRestaurants: 2,
      kakaoLegacyPlaceIdRestaurants: 1,
      kakaoCheckedUnverifiedRestaurants: 0,
      kakaoUncheckedRestaurants: 2,
      duplicateKakaoPlaceGroups: 1,
      duplicateNameAddressGroups: 1,
      deduplicatedRestaurants: 2,
      deduplicationGroups: 1,
      removedDuplicateRecords: 1,
      suspectedSideMenuEntries: 1,
      suspectedSideMenusByReason: { "상차림 비용": 1 },
      categoryReviewCandidates: 1,
      categoryReviewCandidatesByChange: {
        "기타요식업 -> 치킨·피자": 1,
      },
    });
    expect(result.details.suspectedSideMenus[0].menuName).toBe("상차림비");
    expect(restaurants).toEqual(before);
  });
});
