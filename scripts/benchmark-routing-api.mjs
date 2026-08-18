import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  calculateRestaurantDistanceMeters,
  isStrictlyKakaoConfirmed,
} from "./deduplicate-restaurants.mjs";

const KAKAO_DIRECTIONS_URL =
  "https://apis-navi.kakaomobility.com/v1/directions";
const DEFAULT_DATA_PATH = "public/data/incheon-restaurants.json";
const DEFAULT_OUTPUT_DIRECTORY = ".cache/routing-benchmark";
const DEFAULT_TARGET_DISTANCES = [300, 800, 1_500, 3_000, 6_000, 10_000];
const MAX_SAMPLE_COUNT = 10;
const DRIVING_METERS_PER_MINUTE = 24_000 / 60;

function readArgument(name, fallback = "") {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

export function parseCoordinateArgument(value) {
  const [longitudeText, latitudeText, ...rest] = String(value).split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);
  if (
    rest.length > 0 ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error("--origin은 경도,위도 형식이어야 합니다.");
  }
  return { longitude, latitude };
}

function parseTargetDistances(value) {
  const targets = value
    ? value.split(",").map(Number)
    : DEFAULT_TARGET_DISTANCES;
  if (
    targets.length === 0 ||
    targets.length > MAX_SAMPLE_COUNT ||
    targets.some((target) => !Number.isFinite(target) || target <= 0)
  ) {
    throw new Error(
      `--targets에는 1~${MAX_SAMPLE_COUNT}개의 양수 거리(m)를 입력해야 합니다.`,
    );
  }
  return targets;
}

export function selectBenchmarkRestaurants(restaurants, origin, targets) {
  const candidates = restaurants
    .filter(isStrictlyKakaoConfirmed)
    .map((restaurant) => ({
      restaurant,
      straightLineDistanceMeters: Math.round(
        calculateRestaurantDistanceMeters(origin, restaurant),
      ),
    }))
    .filter(({ straightLineDistanceMeters }) =>
      Number.isFinite(straightLineDistanceMeters),
    );
  const selectedIds = new Set();

  return targets.map((targetDistanceMeters) => {
    const match = candidates
      .filter(({ restaurant }) => !selectedIds.has(String(restaurant.id)))
      .sort(
        (left, right) =>
          Math.abs(left.straightLineDistanceMeters - targetDistanceMeters) -
            Math.abs(
              right.straightLineDistanceMeters - targetDistanceMeters,
            ) ||
          String(left.restaurant.id).localeCompare(String(right.restaurant.id)),
      )[0];
    if (!match) {
      throw new Error("거리 구간별 벤치마크 식당을 충분히 찾지 못했습니다.");
    }
    selectedIds.add(String(match.restaurant.id));
    return { targetDistanceMeters, ...match };
  });
}

export function estimateCurrentDrivingMinutes(distanceMeters) {
  return Math.max(1, Math.ceil(distanceMeters / DRIVING_METERS_PER_MINUTE));
}

async function requestKakaoDrivingRoute(origin, destination, apiKey) {
  const url = new URL(KAKAO_DIRECTIONS_URL);
  url.searchParams.set("origin", `${origin.longitude},${origin.latitude}`);
  url.searchParams.set(
    "destination",
    `${destination.longitude},${destination.latitude}`,
  );
  url.searchParams.set("priority", "RECOMMEND");
  url.searchParams.set("summary", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `카카오 자동차 길찾기 요청 실패 (${response.status}): ${body?.msg ?? body?.message ?? "응답 확인 필요"}`,
    );
  }
  const route = body?.routes?.find((candidate) => candidate?.result_code === 0);
  const distanceMeters = Number(route?.summary?.distance);
  const durationSeconds = Number(route?.summary?.duration);
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
    throw new Error(
      `카카오 자동차 경로를 찾지 못했습니다: ${route?.result_msg ?? "요약 정보 없음"}`,
    );
  }
  return { distanceMeters, durationSeconds };
}

function average(values) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

export function summarizeRoutingBenchmark(samples) {
  const absoluteErrors = samples.map((sample) =>
    Math.abs(sample.estimatedMinusActualMinutes),
  );
  return {
    sampleCount: samples.length,
    averageRouteDistanceMultiplier: round(
      average(samples.map((sample) => sample.routeDistanceMultiplier)),
      2,
    ),
    averageEstimatedMinusActualMinutes: round(
      average(
        samples.map((sample) => sample.estimatedMinusActualMinutes),
      ),
    ),
    meanAbsoluteErrorMinutes: round(average(absoluteErrors)),
    medianAbsoluteErrorMinutes: round(median(absoluteErrors)),
    maximumAbsoluteErrorMinutes: Math.max(0, ...absoluteErrors),
    underestimatedCount: samples.filter(
      (sample) => sample.estimatedMinusActualMinutes < 0,
    ).length,
    withinTwoMinutesCount: absoluteErrors.filter((error) => error <= 2).length,
  };
}

export function formatRoutingBenchmarkMarkdown(report) {
  const rows = report.samples
    .map(
      (sample) =>
        `| ${sample.restaurantName} | ${sample.straightLineDistanceMeters.toLocaleString("ko-KR")}m | ${sample.routeDistanceMeters.toLocaleString("ko-KR")}m | ${sample.estimatedMinutes}분 | ${sample.actualMinutes}분 | ${sample.estimatedMinusActualMinutes > 0 ? "+" : ""}${sample.estimatedMinusActualMinutes}분 |`,
    )
    .join("\n");
  const summary = report.summary;
  return `# 자동차 이동시간 정확도 벤치마크

- 생성 시각: ${report.generatedAt}
- 출발지: ${report.originName} (${report.origin.longitude}, ${report.origin.latitude})
- 제공자: 카카오모빌리티 자동차 길찾기
- 현재 추정: 직선거리 ÷ 24km/h 후 분 단위 올림

| 식당 | 직선거리 | 실제 경로 | 현재 추정 | API 시간 | 추정-API |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## 요약

- 표본: ${summary.sampleCount}곳
- 실제 경로/직선거리 평균 배수: ${summary.averageRouteDistanceMultiplier}배
- 평균 절대 오차: ${summary.meanAbsoluteErrorMinutes}분
- 중앙 절대 오차: ${summary.medianAbsoluteErrorMinutes}분
- 최대 절대 오차: ${summary.maximumAbsoluteErrorMinutes}분
- 현재 추정이 실제보다 짧은 표본: ${summary.underestimatedCount}/${summary.sampleCount}
- 오차 2분 이내: ${summary.withinTwoMinutesCount}/${summary.sampleCount}
`;
}

async function writeFileAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}

async function writeBenchmarkReport(report, directory) {
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const outputDirectory = resolve(directory);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = formatRoutingBenchmarkMarkdown(report);
  const latestJson = resolve(outputDirectory, "latest.json");
  const latestMarkdown = resolve(outputDirectory, "latest.md");
  await writeFileAtomic(resolve(outputDirectory, `${timestamp}.json`), json);
  await writeFileAtomic(
    resolve(outputDirectory, `${timestamp}.md`),
    markdown,
  );
  await writeFileAtomic(latestJson, json);
  await writeFileAtomic(latestMarkdown, markdown);
  return { latestJson, latestMarkdown };
}

async function main() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error("KAKAO_REST_API_KEY가 없습니다. .env.local을 확인해 주세요.");
  }
  const originValue = readArgument("origin");
  if (!originValue) {
    throw new Error(
      "출발지를 --origin=경도,위도로 지정해 주세요. 예: --origin=126.6396,37.3863",
    );
  }
  const origin = parseCoordinateArgument(originValue);
  const originName = readArgument("origin-name", "사용자 지정 위치");
  const targets = parseTargetDistances(readArgument("targets"));
  const dataPath = resolve(readArgument("data", DEFAULT_DATA_PATH));
  const outputDirectory = readArgument(
    "output-dir",
    DEFAULT_OUTPUT_DIRECTORY,
  );
  const restaurants = JSON.parse(await readFile(dataPath, "utf8"));
  if (!Array.isArray(restaurants)) {
    throw new Error("식당 데이터는 배열이어야 합니다.");
  }

  const selected = selectBenchmarkRestaurants(restaurants, origin, targets);
  const samples = [];
  for (const [index, selection] of selected.entries()) {
    const route = await requestKakaoDrivingRoute(
      origin,
      selection.restaurant,
      apiKey,
    );
    const estimatedMinutes = estimateCurrentDrivingMinutes(
      selection.straightLineDistanceMeters,
    );
    const actualMinutes = Math.max(1, Math.ceil(route.durationSeconds / 60));
    samples.push({
      targetDistanceMeters: selection.targetDistanceMeters,
      restaurantId: String(selection.restaurant.id),
      restaurantName: String(selection.restaurant.name),
      kakaoPlaceId: String(selection.restaurant.kakaoPlaceId),
      straightLineDistanceMeters: selection.straightLineDistanceMeters,
      routeDistanceMeters: Math.round(route.distanceMeters),
      routeDistanceMultiplier: round(
        route.distanceMeters / selection.straightLineDistanceMeters,
        2,
      ),
      estimatedMinutes,
      actualMinutes,
      estimatedMinusActualMinutes: estimatedMinutes - actualMinutes,
    });
    console.log(
      `경로 ${index + 1}/${selected.length}: ${selection.restaurant.name} · 추정 ${estimatedMinutes}분 / API ${actualMinutes}분`,
    );
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: "kakao-driving",
    origin,
    originName,
    currentEstimate: {
      method: "straight-line-distance",
      assumedSpeedKilometersPerHour: 24,
      rounding: "ceil-minutes",
    },
    samples,
    summary: summarizeRoutingBenchmark(samples),
  };
  const paths = await writeBenchmarkReport(report, outputDirectory);
  console.log(`벤치마크 보고서: ${paths.latestMarkdown}`);
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
