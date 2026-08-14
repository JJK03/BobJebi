import { describe, expect, it } from "vitest";
import {
  adaptGoodPriceRow,
  createExistingLookup,
  findExistingRestaurant,
  normalizeCategory,
  parsePrice,
} from "./sync-good-price-api.mjs";

describe("착한가격업소 API 변환", () => {
  it("문자열 가격과 숫자 가격을 정수로 변환한다", () => {
    expect(parsePrice("10,000원")).toBe(10_000);
    expect(parsePrice(7500)).toBe(7_500);
    expect(parsePrice("가격 변동")).toBeNull();
  });

  it("외식업 카테고리만 앱 카테고리로 정규화한다", () => {
    expect(normalizeCategory("한식_일반")).toBe("한식");
    expect(normalizeCategory("기타 요식업")).toBe("기타요식업");
    expect(normalizeCategory("미용업")).toBeNull();
  });

  it("메뉴와 가격을 같은 번호끼리 묶는다", () => {
    expect(
      adaptGoodPriceRow({
        시도: "인천광역시",
        시군: "연수구",
        업종: "중식",
        업소명: "테스트반점",
        연락처: "032-123-4567",
        주소: "인천광역시 연수구 테스트로 1",
        메뉴1: "자장면",
        가격1: "6,000원",
        메뉴2: "짬뽕",
        가격2: 8000,
      }),
    ).toEqual({
      province: "인천광역시",
      district: "연수구",
      name: "테스트반점",
      phone: "032-123-4567",
      address: "인천광역시 연수구 테스트로 1",
      category: "중식",
      menus: [
        { name: "자장면", price: 6000 },
        { name: "짬뽕", price: 8000 },
      ],
    });
  });

  it("주소 표기가 조금 달라도 이름과 전화번호로 기존 좌표를 찾는다", () => {
    const existing = {
      id: "existing-id",
      province: "인천광역시",
      district: "연수구",
      name: "테스트반점",
      phone: "032-123-4567",
      address: "인천 연수구 테스트로 1",
      latitude: 37.1,
      longitude: 126.1,
    };
    const lookup = createExistingLookup([existing]);

    expect(
      findExistingRestaurant(lookup, {
        ...existing,
        address: "인천광역시 연수구 테스트로 1번길",
      }),
    ).toBe(existing);
  });
});
