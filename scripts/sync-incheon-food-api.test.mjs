import { describe, expect, it } from "vitest";
import {
  adaptIncheonRows,
  findIncheonDistrict,
  inferIncheonCategory,
  isIncheonMealMenu,
} from "./sync-incheon-food-api.mjs";
import { parseCsv } from "./import-incheon-files.mjs";

describe("인천 스마트음식관광 API 변환", () => {
  it("쉼표와 줄바꿈이 포함된 CSV 셀을 읽는다", () => {
    expect(parseCsv('식당명,설명\r\n테스트,"첫 줄, 설명\n둘째 줄"\r\n')).toEqual([
      ["식당명", "설명"],
      ["테스트", "첫 줄, 설명\n둘째 줄"],
    ]);
  });

  it("주소에서 인천 군·구를 찾는다", () => {
    expect(findIncheonDistrict("인천광역시 미추홀구 매소홀로 1")).toBe(
      "미추홀구",
    );
    expect(findIncheonDistrict("", "강화군 강화읍 중앙로 1")).toBe(
      "강화군",
    );
  });

  it("업종과 메뉴명으로 앱 음식 종류를 추론한다", () => {
    expect(
      inferIncheonCategory(
        { BIZ_CRTFCT_BZSTAT_NM: "일식" },
        [{ MENU_NM: "모둠초밥" }],
      ),
    ).toBe("일식");
    expect(
      inferIncheonCategory({}, [{ MENU_NM: "아메리카노" }]),
    ).toBe("기타요식업");
  });

  it("주류·사리·추가 메뉴와 비정상 가격을 후보 메뉴에서 제외한다", () => {
    expect(isIncheonMealMenu("김치찌개", 9_000)).toBe(true);
    expect(isIncheonMealMenu("공기밥", 1_000)).toBe(false);
    expect(isIncheonMealMenu("라면사리 추가", 2_000)).toBe(false);
    expect(isIncheonMealMenu("소주", 5_000)).toBe(false);
    expect(isIncheonMealMenu("가격 오류", 1)).toBe(false);
  });

  it("매장과 메뉴를 식당 ID로 합쳐 앱 데이터로 변환한다", () => {
    const restaurants = adaptIncheonRows(
      [
        {
          RSTR_ID: 22481,
          RSTR_NM: "인천식당",
          BRNCH_NM: "송도점",
          ROAD_NM_ADDR: "인천광역시 연수구 테스트로 1",
          RSTR_LAT: "37.391",
          RSTR_LOT: "126.641",
          RSTR_RPRS_TELNO: "032-123-4567",
          BIZ_CRTFCT_BZSTAT_NM: "한식",
        },
      ],
      [
        {
          RSTR_ID: 22481,
          MENU_NM: "백반",
          MENU_PRC: 9_000,
          RGN_NM: "연수구",
        },
        {
          RSTR_ID: 22481,
          MENU_NM: "백반",
          MENU_PRC: "9,000",
          RGN_NM: "연수구",
        },
      ],
    );

    expect(restaurants).toEqual([
      {
        id: "incheon-22481",
        name: "인천식당 송도점",
        category: "한식",
        province: "인천광역시",
        district: "연수구",
        phone: "032-123-4567",
        address: "인천광역시 연수구 테스트로 1",
        latitude: 37.391,
        longitude: 126.641,
        menus: [{ name: "백반", price: 9_000 }],
      },
    ]);
  });

  it("좌표 또는 가격 메뉴가 없는 매장은 제외한다", () => {
    expect(
      adaptIncheonRows(
        [
          {
            RSTR_ID: 1,
            RSTR_NM: "좌표없는집",
            ROAD_NM_ADDR: "인천광역시 중구 테스트로 1",
          },
        ],
        [{ RSTR_ID: 1, MENU_NM: "메뉴", MENU_PRC: 10_000 }],
      ),
    ).toEqual([]);
  });
});
