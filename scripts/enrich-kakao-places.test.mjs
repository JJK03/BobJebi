import { describe, expect, it } from "vitest";
import {
  normalizePlaceAddress,
  normalizePlaceName,
  selectKakaoPlace,
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

describe("selectKakaoPlace", () => {
  const restaurant = {
    name: "행복식당",
    address: "인천광역시 연수구 행복로 1",
  };

  it("이름이 같고 150m 안에서 가장 가까운 장소를 선택한다", () => {
    const selected = selectKakaoPlace(
      [
        { id: "far", place_name: "행복식당", distance: "120" },
        { id: "near", place_name: "행복 식당", distance: "35" },
        { id: "wrong", place_name: "행복분식", distance: "5" },
      ],
      restaurant,
    );

    expect(selected?.id).toBe("near");
  });

  it("이름만 같고 150m보다 멀면 다른 지점일 수 있어 선택하지 않는다", () => {
    expect(
      selectKakaoPlace(
        [{ id: "other-branch", place_name: "행복식당", distance: "151" }],
        restaurant,
      ),
    ).toBeUndefined();
  });

  it("카카오 지점명이 달라도 음식점이고 주소가 같으면 선택한다", () => {
    const selected = selectKakaoPlace(
      [
        {
          id: "parking",
          place_name: "행복식당 주차장",
          distance: "3",
          category_group_code: "PK6",
          road_address_name: "인천 연수구 행복로 1",
        },
        {
          id: "branch",
          place_name: "행복식당 연수점",
          distance: "8",
          category_group_code: "FD6",
          road_address_name: "인천 연수구 행복로 1",
        },
      ],
      restaurant,
    );

    expect(selected?.id).toBe("branch");
  });

  it("이름이 달라도 주소가 같은 음식점이 아니면 선택하지 않는다", () => {
    expect(
      selectKakaoPlace(
        [
          {
            id: "parking",
            place_name: "행복식당 주차장",
            distance: "3",
            category_group_code: "PK6",
            road_address_name: "인천 연수구 행복로 1",
          },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });

  it("이름이 다르거나 너무 먼 장소는 연결하지 않는다", () => {
    expect(
      selectKakaoPlace(
        [
          { id: "wrong", place_name: "행복분식", distance: "10" },
          { id: "far", place_name: "행복식당", distance: "700" },
        ],
        restaurant,
      ),
    ).toBeUndefined();
  });
});
