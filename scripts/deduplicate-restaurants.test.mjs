import { describe, expect, it } from "vitest";
import {
  DEDUPLICATION_REASONS,
  deduplicateRestaurants,
  findRestaurantDuplicateGroups,
} from "./deduplicate-restaurants.mjs";

const createRestaurant = (overrides = {}) => ({
  id: "restaurant-1",
  name: "행복식당",
  category: "한식",
  province: "인천광역시",
  district: "연수구",
  address: "인천광역시 연수구 행복로 1",
  latitude: 37.39,
  longitude: 126.64,
  menus: [{ name: "백반", price: 9_000 }],
  ...overrides,
});

const confirmedVerification = {
  provider: "kakao",
  status: "confirmed",
  matchedBy: "name-address",
  distanceMeters: 10,
  checkedAt: "2026-08-18T00:00:00.000Z",
};

describe("식당 중복 판정", () => {
  it("엄격 확인된 같은 카카오 장소 ID를 중복으로 판정한다", () => {
    const groups = findRestaurantDuplicateGroups([
      createRestaurant({
        id: "a",
        kakaoPlaceId: "100",
        placeVerification: confirmedVerification,
      }),
      createRestaurant({
        id: "b",
        name: "행복식당 연수점",
        address: "인천 연수구 다른 주소 2",
        kakaoPlaceId: "100",
        placeVerification: confirmedVerification,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toContain(
      DEDUPLICATION_REASONS.CONFIRMED_KAKAO_PLACE_ID,
    );
  });

  it("검증 근거가 없는 같은 카카오 ID만으로는 병합하지 않는다", () => {
    const groups = findRestaurantDuplicateGroups([
      createRestaurant({ id: "a", kakaoPlaceId: "100" }),
      createRestaurant({
        id: "b",
        name: "다른식당",
        address: "인천 연수구 다른로 2",
        latitude: 37.4,
        longitude: 126.7,
        kakaoPlaceId: "100",
      }),
    ]);

    expect(groups).toEqual([]);
  });

  it("정규화된 상호명과 주소가 같으면 중복으로 판정한다", () => {
    const groups = findRestaurantDuplicateGroups([
      createRestaurant({ id: "a", name: "(주) 행복 식당" }),
      createRestaurant({
        id: "b",
        name: "행복식당",
        address: "인천광역시 연수구 행복로1",
        latitude: 37.5,
        longitude: 126.8,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toContain(
      DEDUPLICATION_REASONS.NAME_ADDRESS,
    );
  });

  it("상호명이 같고 좌표가 50m 이내면 주소 표기가 달라도 중복으로 판정한다", () => {
    const groups = findRestaurantDuplicateGroups([
      createRestaurant({ id: "a" }),
      createRestaurant({
        id: "b",
        address: "인천 연수구 행복로 1번길",
        latitude: 37.3902,
        longitude: 126.6402,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toContain(
      DEDUPLICATION_REASONS.NAME_NEARBY_COORDINATES,
    );
  });

  it("상호명이 같아도 좌표가 멀고 주소가 다르면 별도 식당으로 유지한다", () => {
    const result = deduplicateRestaurants([
      createRestaurant({ id: "a" }),
      createRestaurant({
        id: "b",
        address: "인천 연수구 먼로 20",
        latitude: 37.4,
        longitude: 126.7,
      }),
    ]);

    expect(result.restaurants).toHaveLength(2);
    expect(result.removedCount).toBe(0);
  });

  it("서로 다른 엄격 확인 카카오 ID는 이름과 주소가 같아도 병합하지 않는다", () => {
    const result = deduplicateRestaurants([
      createRestaurant({
        id: "a",
        kakaoPlaceId: "100",
        placeVerification: confirmedVerification,
      }),
      createRestaurant({
        id: "b",
        kakaoPlaceId: "200",
        placeVerification: confirmedVerification,
      }),
    ]);

    expect(result.restaurants).toHaveLength(2);
  });
});

describe("중복 식당 병합", () => {
  it("엄격 확인 레코드를 대표로 선택하고 서로 다른 메뉴와 연락처를 보존한다", () => {
    const result = deduplicateRestaurants([
      createRestaurant({
        id: "legacy",
        phone: "032-111-1111",
        menus: [
          { name: "백반", price: 9_000 },
          { name: "제육볶음", price: 10_000 },
        ],
      }),
      createRestaurant({
        id: "confirmed",
        kakaoPlaceId: "100",
        kakaoPlaceUrl: "https://place.map.kakao.com/100",
        placeVerification: confirmedVerification,
        menus: [
          { name: "백반", price: 9_000 },
          { name: "김치찌개", price: 8_000 },
        ],
      }),
    ]);

    expect(result.removedCount).toBe(1);
    expect(result.groups[0]).toMatchObject({
      canonicalId: "confirmed",
      mergedIds: ["legacy"],
      recordCount: 2,
    });
    expect(result.restaurants[0]).toMatchObject({
      id: "confirmed",
      phone: "032-111-1111",
      kakaoPlaceId: "100",
      placeVerification: confirmedVerification,
    });
    expect(result.restaurants[0].menus).toEqual([
      { name: "김치찌개", price: 8_000 },
      { name: "백반", price: 9_000 },
      { name: "제육볶음", price: 10_000 },
    ]);
  });

  it("중복 연결이 이어져도 서로 다른 엄격 확인 장소를 한 그룹으로 합치지 않는다", () => {
    const result = deduplicateRestaurants([
      createRestaurant({
        id: "confirmed-a",
        kakaoPlaceId: "100",
        placeVerification: confirmedVerification,
      }),
      createRestaurant({ id: "legacy-between" }),
      createRestaurant({
        id: "confirmed-b",
        kakaoPlaceId: "200",
        placeVerification: confirmedVerification,
      }),
    ]);

    expect(result.restaurants).toHaveLength(2);
    expect(result.groups).toHaveLength(1);
  });
});
