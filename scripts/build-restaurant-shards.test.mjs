import { describe, expect, it } from "vitest";
import { selectRestaurantsForBuild } from "./build-restaurant-shards.mjs";

const createRestaurant = (id, confirmed = false) => ({
  id,
  name: `식당 ${id}`,
  category: "한식",
  address: `인천 연수구 테스트로 ${id}`,
  latitude: 37.39,
  longitude: 126.64,
  menus: [{ name: "백반", price: 9_000 }],
  ...(confirmed
    ? {
        kakaoPlaceId: `kakao-${id}`,
        placeVerification: {
          provider: "kakao",
          status: "confirmed",
          matchedBy: "name-address",
          distanceMeters: 10,
          checkedAt: "2026-08-18T00:00:00.000Z",
        },
      }
    : {}),
});

describe("shard 카카오 검증 정책", () => {
  it("all 정책은 검증 상태와 관계없이 전체 식당을 유지한다", () => {
    const restaurants = [
      createRestaurant("confirmed", true),
      createRestaurant("legacy"),
    ];

    expect(selectRestaurantsForBuild(restaurants, "all")).toBe(restaurants);
  });

  it("confirmed-only 정책은 엄격 확인된 식당만 반환한다", () => {
    const restaurants = [
      createRestaurant("confirmed-1", true),
      createRestaurant("confirmed-2", true),
      createRestaurant("legacy"),
    ];

    expect(
      selectRestaurantsForBuild(restaurants, "confirmed-only", 0.2).map(
        ({ id }) => id,
      ),
    ).toEqual(["confirmed-1", "confirmed-2"]);
  });

  it("엄격 확인률이 안전 기준보다 낮으면 부분 데이터 배포를 차단한다", () => {
    const restaurants = [
      createRestaurant("confirmed", true),
      ...Array.from({ length: 9 }, (_, index) =>
        createRestaurant(`legacy-${index}`),
      ),
    ];

    expect(() =>
      selectRestaurantsForBuild(restaurants, "confirmed-only", 0.2),
    ).toThrow("카카오 엄격 확인률이 10.0%")
  });

  it("알 수 없는 정책은 거부한다", () => {
    expect(() => selectRestaurantsForBuild([], "unknown")).toThrow(
      "지원하지 않는 카카오 검증 정책",
    );
  });
});
