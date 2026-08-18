import { describe, expect, it } from "vitest";
import {
  areNaverAddressesCompatible,
  buildSearchQueries,
  formatNaverCrossCheckMarkdown,
  normalizeNaverAddress,
  parseNaverCoordinate,
  selectCandidatesByIds,
  selectEvenlySpacedCandidates,
  selectNaverLocalMatch,
  stripNaverMarkup,
  summarizeNaverCrossCheckResults,
} from "./cross-check-naver-local.mjs";

const restaurant = {
  id: "restaurant-1",
  name: "행복식당",
  address: "인천광역시 연수구 행복로 1 1층",
  latitude: 37.38,
  longitude: 126.64,
};

const matchingItem = {
  title: "<b>행복식당</b>",
  category: "한식&gt;백반",
  address: "인천 연수구 행복동 1",
  roadAddress: "인천광역시 연수구 행복로 1",
  mapx: "1266401000",
  mapy: "373800000",
  link: "https://example.com/place",
};

describe("네이버 지역 검색 값 정규화", () => {
  it("강조 태그와 HTML 엔티티를 제거한다", () => {
    expect(stripNaverMarkup("<b>행복&amp;식당</b>")).toBe("행복&식당");
  });

  it("WGS84 정수 좌표와 소수 좌표를 모두 읽는다", () => {
    expect(parseNaverCoordinate("1266401000", "longitude")).toBe(126.6401);
    expect(parseNaverCoordinate("37.38", "latitude")).toBe(37.38);
    expect(parseNaverCoordinate("invalid", "latitude")).toBeNull();
  });

  it("행정구역 약칭과 상세 층 표기가 달라도 주소를 비교한다", () => {
    expect(normalizeNaverAddress("강원특별자치도 춘천시 중앙로 1")).toBe(
      normalizeNaverAddress("강원 춘천시 중앙로 1"),
    );
    expect(
      areNaverAddressesCompatible(
        "인천광역시 연수구 행복로 1 1층",
        "인천 연수구 행복로 1",
      ),
    ).toBe(true);
    expect(
      areNaverAddressesCompatible(
        "인천광역시 서구 완정로 144",
        "인천광역시 검단구 완정로 144 108호",
      ),
    ).toBe(true);
  });

  it("변경될 수 있는 구·군 대신 시·도와 상호명을 검색한다", () => {
    expect(
      buildSearchQueries({
        name: "행복식당",
        province: "인천광역시",
        district: "서구",
      }),
    ).toEqual(["행복식당 인천광역시", "행복식당"]);
  });
});

describe("selectNaverLocalMatch", () => {
  it("상호명, 주소, 좌표가 모두 맞는 결과만 엄격 일치로 선택한다", () => {
    const result = selectNaverLocalMatch([matchingItem], restaurant);
    expect(result.match).toMatchObject({
      name: "행복식당",
      exactName: true,
      addressMatch: true,
      coordinatesMatch: true,
      strictMatch: true,
    });
  });

  it.each([
    ["상호명", { title: "다른식당" }],
    ["주소", { roadAddress: "인천 연수구 다른로 99" }],
    ["좌표", { mapx: "1266500000" }],
  ])("%s이 다르면 엄격 일치시키지 않는다", (_, override) => {
    const result = selectNaverLocalMatch(
      [{ ...matchingItem, ...override }],
      restaurant,
    );
    expect(result.match).toBeNull();
    expect(result.candidates).toHaveLength(1);
  });
});

describe("교차 검증 표본과 보고서", () => {
  it("전체 목록에서 앞, 중간, 뒤를 균등하게 선택한다", () => {
    const selected = selectEvenlySpacedCandidates(
      Array.from({ length: 10 }, (_, id) => ({ id })),
      3,
    );
    expect(selected.map(({ id }) => id)).toEqual([0, 5, 9]);
  });

  it("지정한 ID의 후보만 원본 순서대로 선택한다", () => {
    const selected = selectCandidatesByIds(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      ["c", "a"],
    );
    expect(selected.map(({ id }) => id)).toEqual(["a", "c"]);
  });

  it("동일 주소와 좌표에서 상호명만 달라진 후보를 별도 집계한다", () => {
    const summary = summarizeNaverCrossCheckResults(
      [
        {
          eligibleCount: 10,
          samples: [
            {
              status: "no-strict-match",
              candidates: [
                {
                  exactName: false,
                  addressMatch: true,
                  coordinatesMatch: true,
                },
              ],
            },
          ],
        },
      ],
      2,
    );
    expect(summary).toMatchObject({
      sampleCount: 1,
      requestCount: 2,
      probableNameChangeCount: 1,
    });
  });

  it("원본 비수정 정책과 판정 통계를 Markdown에 표시한다", () => {
    const report = {
      generatedAt: "2026-08-18T00:00:00.000Z",
      policy: { maxDistanceMeters: 150 },
      summary: {
        eligibleCount: 10,
        sampleCount: 1,
        requestCount: 1,
        strictMatchCount: 1,
        noStrictMatchCount: 0,
        noResultCount: 0,
        probableNameChangeCount: 0,
      },
      sources: [
        {
          label: "착한가격업소",
          samples: [
            {
              restaurant: { name: "행복식당" },
              status: "strict-match",
              match: {
                name: "행복식당",
                distanceMeters: 10,
                exactName: true,
                addressMatch: true,
                coordinatesMatch: true,
              },
              candidates: [],
            },
          ],
        },
      ],
    };
    const markdown = formatNaverCrossCheckMarkdown(report);
    expect(markdown).toContain("엄격 일치: 1곳");
    expect(markdown).toContain("원본 데이터 수정: 안 함");
    expect(markdown).toContain("행복식당 · 10m · 이름✓ 주소✓ 좌표✓");
  });
});
