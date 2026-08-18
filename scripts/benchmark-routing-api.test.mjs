import { describe, expect, it } from "vitest";
import {
  estimateCurrentDrivingMinutes,
  formatRoutingBenchmarkMarkdown,
  parseCoordinateArgument,
  selectBenchmarkRestaurants,
  summarizeRoutingBenchmark,
} from "./benchmark-routing-api.mjs";

const confirmedRestaurant = (id, latitude, longitude) => ({
  id,
  name: `식당 ${id}`,
  latitude,
  longitude,
  kakaoPlaceId: `kakao-${id}`,
  placeVerification: {
    provider: "kakao",
    status: "confirmed",
    checkedAt: "2026-08-18T00:00:00.000Z",
  },
});

describe("자동차 길찾기 벤치마크", () => {
  it("경도,위도 형식의 출발지를 검증한다", () => {
    expect(parseCoordinateArgument("126.64,37.38")).toEqual({
      longitude: 126.64,
      latitude: 37.38,
    });
    expect(() => parseCoordinateArgument("37.38")).toThrow(
      "경도,위도",
    );
    expect(() => parseCoordinateArgument("200,37.38")).toThrow(
      "경도,위도",
    );
  });

  it("엄격 확인 식당을 목표 거리별로 중복 없이 선택한다", () => {
    const origin = { latitude: 37, longitude: 127 };
    const restaurants = [
      confirmedRestaurant("near", 37.003, 127),
      confirmedRestaurant("far", 37.01, 127),
      {
        ...confirmedRestaurant("unverified", 37.006, 127),
        placeVerification: {
          provider: "kakao",
          status: "unverified",
          checkedAt: "2026-08-18T00:00:00.000Z",
        },
      },
    ];

    const selected = selectBenchmarkRestaurants(
      restaurants,
      origin,
      [300, 1_000],
    );
    expect(selected.map(({ restaurant }) => restaurant.id)).toEqual([
      "near",
      "far",
    ]);
  });

  it("현재 추정과 API 경로의 오차 통계를 계산한다", () => {
    expect(estimateCurrentDrivingMinutes(1_000)).toBe(3);
    const samples = [
      {
        routeDistanceMultiplier: 1.2,
        estimatedMinusActualMinutes: -2,
      },
      {
        routeDistanceMultiplier: 1.8,
        estimatedMinusActualMinutes: -6,
      },
      {
        routeDistanceMultiplier: 1.5,
        estimatedMinusActualMinutes: 1,
      },
    ];
    expect(summarizeRoutingBenchmark(samples)).toEqual({
      sampleCount: 3,
      averageRouteDistanceMultiplier: 1.5,
      averageEstimatedMinusActualMinutes: -2.3,
      meanAbsoluteErrorMinutes: 3,
      medianAbsoluteErrorMinutes: 2,
      maximumAbsoluteErrorMinutes: 6,
      underestimatedCount: 2,
      withinTwoMinutesCount: 2,
    });
  });

  it("사람이 읽을 수 있는 Markdown 결과를 만든다", () => {
    const report = {
      generatedAt: "2026-08-18T00:00:00.000Z",
      originName: "인천대입구역",
      origin: { longitude: 126.64, latitude: 37.38 },
      samples: [
        {
          restaurantName: "테스트식당",
          straightLineDistanceMeters: 1_000,
          routeDistanceMeters: 1_500,
          estimatedMinutes: 3,
          actualMinutes: 7,
          estimatedMinusActualMinutes: -4,
        },
      ],
      summary: {
        sampleCount: 1,
        averageRouteDistanceMultiplier: 1.5,
        meanAbsoluteErrorMinutes: 4,
        medianAbsoluteErrorMinutes: 4,
        maximumAbsoluteErrorMinutes: 4,
        underestimatedCount: 1,
        withinTwoMinutesCount: 0,
      },
    };
    const markdown = formatRoutingBenchmarkMarkdown(report);
    expect(markdown).toContain("테스트식당");
    expect(markdown).toContain("평균 절대 오차: 4분");
    expect(markdown).toContain("현재 추정이 실제보다 짧은 표본: 1/1");
  });
});
