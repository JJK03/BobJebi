import { describe, expect, it } from "vitest";
import {
  createDataUpdateReport,
  formatDataUpdateReportMarkdown,
} from "./data-update-report.mjs";

function createRestaurant(id, overrides = {}) {
  return {
    id,
    name: `식당 ${id}`,
    category: "한식",
    province: "인천광역시",
    district: "연수구",
    address: `인천광역시 연수구 ${id}로 1`,
    latitude: 37.4,
    longitude: 126.6,
    menus: [{ name: "백반", price: 9_000 }],
    ...overrides,
  };
}

const confirmed = (kakaoPlaceId, checkedAt) => ({
  kakaoPlaceId,
  placeVerification: {
    provider: "kakao",
    status: "confirmed",
    matchedBy: "name-address",
    distanceMeters: 5,
    checkedAt,
  },
});

describe("데이터 갱신 보고서", () => {
  it("신규·제외·변경과 카카오 검증 및 운영 후보 수를 계산한다", () => {
    const previousRestaurants = [
      createRestaurant("same", confirmed("100", "2026-08-01T00:00:00.000Z")),
      createRestaurant("removed", {
        placeVerification: {
          provider: "kakao",
          status: "unverified",
          checkedAt: "2026-08-01T00:00:00.000Z",
        },
      }),
      createRestaurant("changed", confirmed("200", "2026-08-01T00:00:00.000Z")),
    ];
    const nextRestaurants = [
      createRestaurant("same", confirmed("100", "2026-08-18T00:00:00.000Z")),
      createRestaurant("changed", {
        ...confirmed("200", "2026-08-18T00:00:00.000Z"),
        menus: [{ name: "김치찌개", price: 10_000 }],
      }),
      createRestaurant("new-failed", {
        placeVerification: {
          provider: "kakao",
          status: "unverified",
          checkedAt: "2026-08-18T00:00:00.000Z",
        },
      }),
      createRestaurant("new-unchecked"),
      createRestaurant("duplicate", confirmed("200", "2026-08-18T00:00:00.000Z")),
    ];

    const report = createDataUpdateReport({
      source: "good-price",
      previousRestaurants,
      nextRestaurants,
      generatedAt: "2026-08-18T00:00:00.000Z",
      input: { origin: "test", excludedDuringTransform: 2 },
    });

    expect(report.summary).toEqual({
      previousTotal: 3,
      nextTotal: 5,
      added: 3,
      removed: 1,
      changed: 1,
      unchanged: 1,
    });
    expect(report.verification.next).toEqual({
      confirmed: 3,
      failed: 1,
      unchecked: 1,
    });
    expect(report.operationalCandidates.next).toMatchObject({
      verificationEligible: 3,
      excludedByVerification: 2,
      duplicateGroups: 1,
      duplicatesRemoved: 1,
      finalCandidates: 2,
    });
    expect(report.changes.changed[0]).toMatchObject({
      id: "changed",
      changedFields: ["menus"],
    });
  });

  it("검사 시각만 달라진 식당은 내용 변경으로 세지 않는다", () => {
    const report = createDataUpdateReport({
      source: "incheon-smart-food",
      previousRestaurants: [
        createRestaurant("same", confirmed("100", "2026-08-01T00:00:00.000Z")),
      ],
      nextRestaurants: [
        createRestaurant("same", confirmed("100", "2026-08-18T00:00:00.000Z")),
      ],
    });

    expect(report.summary.changed).toBe(0);
    expect(report.summary.unchanged).toBe(1);
  });

  it("Markdown 보고서에 핵심 갱신 지표를 표시한다", () => {
    const report = createDataUpdateReport({
      source: "good-price",
      previousRestaurants: [],
      nextRestaurants: [createRestaurant("new")],
      generatedAt: "2026-08-18T00:00:00.000Z",
      input: { origin: "public-data-api", excludedDuringTransform: 3 },
    });
    const markdown = formatDataUpdateReportMarkdown(report);

    expect(markdown).toContain("| 신규 | 1 |")
    expect(markdown).toContain("| 변환 단계에서 제외 | 3 |")
    expect(markdown).toContain("| 매칭 실패 | 0 | 0 |")
    expect(markdown).toContain("`new` 식당 new")
  });
});
