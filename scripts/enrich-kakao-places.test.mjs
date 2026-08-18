import { describe, expect, it } from "vitest";
import {
  normalizePlaceAddress,
  normalizePlaceName,
  selectKakaoPlace,
  selectKakaoPlaceMatch,
} from "./enrich-kakao-places.mjs";

describe("normalizePlaceName", () => {
  it("공백과 회사 표기를 제거해 이름을 비교할 수 있게 한다", () => {
    expect(normalizePlaceName("(주) 행복 식당")).toBe("행복식당");
  });
});

describe("normalizePlaceAddress", () => {
  it("인천 행정구역 표기와 공백 차이를 제거한다", () => {
    expect(normalizePlaceAddress("인천광역시 연수구 먼우금로 208")).toBe(
      normalizePlaceAddress("인천 연수구 먼우금로 208"),
    );
  });
});

describe("selectKakaoPlaceMatch", () => {
  const restaurant = {
    name: "행복식당",
    address: "인천광역시 연수구 행복로 1",
  };

  it("상호명이 같고 음식점이면서 150m 안인 가장 가까운 장소를 선택한다", () => {
    const selected = selectKakaoPlaceMatch(
      [
        {
          id: "far",
          place_name: "행복식당",
          distance: "120",
          category_group_code: "FD6",
        },
        {
          id: "near",
          place_name: "행복 식당",
          distance: "35",
          category_group_code: "FD6",
        },
        {
          id: "wrong",
          place_name: "행복분식",
          distance: "5",
          category_group_code: "FD6",
        },
      ],
      restaurant,
    );

    expect(selected).toMatchObject({
      place: { id: "near" },
      matchedBy: "name-coordinates",
      distanceMeters: 35,
    });
  });

  it("상호명과 주소가 모두 같으면 150m 밖에서도 최대 범위 안의 장소를 선택한다", () => {
    const selected = selectKakaoPlaceMatch(
      [
        {
          id: "same-address",
          place_name: "행복식당",
          distance: "320",
          category_group_code: "FD6",
          road_address_name: "인천 연수구 행복로 1",
        },
      ],
      restaurant,
    );

    expect(selected).toMatchObject({
      place: { id: "same-address" },
      matchedBy: "name-address",
      distanceMeters: 320,
    });
  });

  it("주소가 같은 음식점이어도 상호명이 다르면 선택하지 않는다", () => {
    expect(
      selectKakaoPlaceMatch(
        [
          {
            id: "other-branch",
            place_name: "행복식당 연수점",
            distance: "8",
            category_group_code: "FD6",
            road_address_name: "인천 연수구 행복로 1",
          },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });

  it("상호명이 같아도 음식점이나 카페가 아니면 선택하지 않는다", () => {
    expect(
      selectKakaoPlaceMatch(
        [
          {
            id: "parking",
            place_name: "행복식당",
            distance: "3",
            category_group_code: "PK6",
            road_address_name: "인천 연수구 행복로 1",
          },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });

  it("상호명만 같고 150m보다 멀면 다른 지점일 수 있어 선택하지 않는다", () => {
    expect(
      selectKakaoPlaceMatch(
        [
          {
            id: "far-branch",
            place_name: "행복식당",
            distance: "151",
            category_group_code: "FD6",
          },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });

  it("최대 검색 범위를 벗어난 장소는 주소가 같아도 선택하지 않는다", () => {
    expect(
      selectKakaoPlaceMatch(
        [
          {
            id: "too-far",
            place_name: "행복식당",
            distance: "501",
            category_group_code: "FD6",
            road_address_name: "인천 연수구 행복로 1",
          },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });
});

describe("selectKakaoPlace", () => {
  it("기존 호출부를 위해 선택된 카카오 문서만 반환한다", () => {
    expect(
      selectKakaoPlace(
        [
          {
            id: "place",
            place_name: "행복식당",
            distance: "20",
            category_group_code: "FD6",
          },
        ],
        { name: "행복식당", address: "인천 연수구 행복로 1" },
      ),
    ).toMatchObject({ id: "place" });
  });
});
