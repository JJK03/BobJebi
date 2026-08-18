import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  calculateRestaurantDistanceMeters,
  isStrictlyKakaoConfirmed,
  normalizeRestaurantAddress,
  normalizeRestaurantName,
} from "./deduplicate-restaurants.mjs";

const NAVER_LOCAL_SEARCH_URL =
  "https://naverapihub.apigw.ntruss.com/search/v1/local";
const DEFAULT_OUTPUT_DIRECTORY = ".cache/naver-local-cross-check";
const DEFAULT_LIMIT_PER_SOURCE = 10;
const MAX_LIMIT_PER_SOURCE = 100;
const DEFAULT_MAX_DISTANCE_METERS = 150;

const DATASETS = {
  "good-price": {
    label: "착한가격업소",
    path: "public/data/restaurants.json",
  },
  "incheon-smart-food": {
    label: "인천 스마트음식관광",
    path: "public/data/incheon-restaurants.json",
  },
};

const REGION_ALIASES = [
  [/서울특별시|서울시/g, "서울"],
  [/부산광역시|부산시/g, "부산"],
  [/대구광역시|대구시/g, "대구"],
  [/인천광역시|인천시/g, "인천"],
  [/광주광역시|광주시/g, "광주"],
  [/대전광역시|대전시/g, "대전"],
  [/울산광역시|울산시/g, "울산"],
  [/세종특별자치시|세종시/g, "세종"],
  [/경기도/g, "경기"],
  [/강원특별자치도|강원도/g, "강원"],
  [/충청북도/g, "충북"],
  [/충청남도/g, "충남"],
  [/전북특별자치도|전라북도/g, "전북"],
  [/전라남도/g, "전남"],
  [/경상북도/g, "경북"],
  [/경상남도/g, "경남"],
  [/제주특별자치도|제주도/g, "제주"],
];

const wait = (milliseconds) =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function readArgument(name, fallback = "") {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

export function stripNaverMarkup(value) {
  return decodeHtmlEntities(value).replace(/<[^>]*>/g, "").trim();
}

export function parseNaverCoordinate(value, axis) {
  let coordinate = Number(value);
  if (!Number.isFinite(coordinate)) return null;

  const maximum = axis === "longitude" ? 180 : 90;
  if (Math.abs(coordinate) > maximum) {
    coordinate /= 10_000_000;
  }
  return Math.abs(coordinate) <= maximum ? coordinate : null;
}

export function normalizeNaverAddress(value) {
  let normalized = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "");
  for (const [pattern, replacement] of REGION_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalizeRestaurantAddress(normalized);
}

function extractRoadAddressCore(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "");
  const match = normalized.match(
    /([0-9a-z가-힣]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/,
  );
  return match ? normalizeRestaurantAddress(`${match[1]}${match[2]}`) : "";
}

export function areNaverAddressesCompatible(left, right) {
  const normalizedLeft = normalizeNaverAddress(left);
  const normalizedRight = normalizeNaverAddress(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftRoadCore = extractRoadAddressCore(left);
  const rightRoadCore = extractRoadAddressCore(right);
  if (leftRoadCore && leftRoadCore === rightRoadCore) return true;

  const shorter =
    normalizedLeft.length <= normalizedRight.length
      ? normalizedLeft
      : normalizedRight;
  const longer =
    normalizedLeft.length > normalizedRight.length
      ? normalizedLeft
      : normalizedRight;
  return shorter.length >= 8 && longer.startsWith(shorter);
}

function evaluateNaverItem(item, restaurant, maxDistanceMeters) {
  const name = stripNaverMarkup(item.title);
  const longitude = parseNaverCoordinate(item.mapx, "longitude");
  const latitude = parseNaverCoordinate(item.mapy, "latitude");
  const distanceMeters = Math.round(
    calculateRestaurantDistanceMeters(restaurant, { latitude, longitude }),
  );
  const exactName =
    normalizeRestaurantName(name) === normalizeRestaurantName(restaurant.name);
  const addressMatch = [item.roadAddress, item.address].some((address) =>
    areNaverAddressesCompatible(restaurant.address, address),
  );
  const coordinatesMatch = distanceMeters <= maxDistanceMeters;

  return {
    name,
    category: stripNaverMarkup(item.category),
    address: stripNaverMarkup(item.address),
    roadAddress: stripNaverMarkup(item.roadAddress),
    link: String(item.link ?? ""),
    latitude,
    longitude,
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    exactName,
    addressMatch,
    coordinatesMatch,
    strictMatch: exactName && addressMatch && coordinatesMatch,
  };
}

export function selectNaverLocalMatch(
  items,
  restaurant,
  maxDistanceMeters = DEFAULT_MAX_DISTANCE_METERS,
) {
  const candidates = items
    .map((item) => evaluateNaverItem(item, restaurant, maxDistanceMeters))
    .sort(
      (left, right) =>
        Number(right.strictMatch) - Number(left.strictMatch) ||
        Number(right.exactName) - Number(left.exactName) ||
        Number(right.addressMatch) - Number(left.addressMatch) ||
        (left.distanceMeters ?? Infinity) -
          (right.distanceMeters ?? Infinity),
    );

  return {
    match: candidates.find((candidate) => candidate.strictMatch) ?? null,
    candidates,
  };
}

export function selectEvenlySpacedCandidates(restaurants, limit) {
  if (limit >= restaurants.length) return [...restaurants];
  if (limit <= 0 || restaurants.length === 0) return [];
  if (limit === 1) return [restaurants[Math.floor(restaurants.length / 2)]];

  return Array.from({ length: limit }, (_, index) =>
    restaurants[
      Math.round((index * (restaurants.length - 1)) / (limit - 1))
    ],
  );
}

export function selectCandidatesByIds(restaurants, ids) {
  const requestedIds = new Set(ids.map(String));
  return restaurants.filter((restaurant) =>
    requestedIds.has(String(restaurant.id)),
  );
}

export function buildSearchQueries(restaurant) {
  return [
    [restaurant.name, restaurant.province].filter(Boolean).join(" "),
    restaurant.name,
  ].filter((query, index, queries) => query && queries.indexOf(query) === index);
}

async function requestNaverLocalSearch(
  query,
  clientId,
  clientSecret,
  retries = 2,
  timeoutMilliseconds = 10_000,
) {
  const url = new URL(NAVER_LOCAL_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "5");
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "random");
  url.searchParams.set("format", "json");

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": clientId,
          "X-NCP-APIGW-API-KEY": clientSecret,
        },
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`네이버 지역 검색 응답 시간 초과: ${query}`, {
          cause: error,
        });
      }
      await wait(500 * 2 ** attempt);
      continue;
    }

    const body = await response.json().catch(() => null);
    if (response.ok) return body;
    if ([401, 403].includes(response.status)) {
      throw new Error(
        `네이버 API HUB 인증 또는 Local Search 권한을 확인해 주세요. (${response.status})`,
      );
    }

    const canRetry = response.status === 429 || response.status >= 500;
    if (attempt === retries || !canRetry) {
      const message = body?.error?.message ?? body?.errorMessage ?? "";
      throw new Error(
        `네이버 지역 검색 실패 (${response.status})${message ? `: ${message}` : ""}`,
      );
    }
    await wait(500 * 2 ** attempt);
  }
}

export function summarizeNaverCrossCheckResults(sources, requestCount) {
  const samples = sources.flatMap((source) => source.samples);
  const hasProbableNameChange = (sample) =>
    sample.status === "no-strict-match" &&
    sample.candidates.some(
      (candidate) =>
        !candidate.exactName &&
        candidate.addressMatch &&
        candidate.coordinatesMatch,
    );
  return {
    sourceCount: sources.length,
    eligibleCount: sources.reduce(
      (sum, source) => sum + source.eligibleCount,
      0,
    ),
    sampleCount: samples.length,
    requestCount,
    strictMatchCount: samples.filter((sample) => sample.status === "strict-match")
      .length,
    noStrictMatchCount: samples.filter(
      (sample) => sample.status === "no-strict-match",
    ).length,
    noResultCount: samples.filter((sample) => sample.status === "no-result")
      .length,
    probableNameChangeCount: samples.filter(hasProbableNameChange).length,
  };
}

function formatCandidateSignals(sample) {
  const candidate = sample.match ?? sample.candidates[0];
  if (!candidate) return "검색 결과 없음";
  const signals = [
    candidate.exactName ? "이름✓" : "이름✗",
    candidate.addressMatch ? "주소✓" : "주소✗",
    candidate.coordinatesMatch ? "좌표✓" : "좌표✗",
  ];
  return `${candidate.name} · ${candidate.distanceMeters ?? "?"}m · ${signals.join(" ")}`;
}

export function formatNaverCrossCheckMarkdown(report) {
  const rows = report.sources
    .flatMap((source) =>
      source.samples.map(
        (sample) =>
          `| ${source.label} | ${sample.restaurant.name} | ${sample.status} | ${formatCandidateSignals(sample)} |`,
      ),
    )
    .join("\n");
  const summary = report.summary;

  return `# 네이버 Local Search 교차 검증

- 생성 시각: ${report.generatedAt}
- 정책: 상호명 + 주소 + 좌표 ${report.policy.maxDistanceMeters}m 이내 모두 일치
- 원본 데이터 수정: 안 함
- 검색 API 요청: ${summary.requestCount}회

## 요약

- 카카오 미확인 전체: ${summary.eligibleCount.toLocaleString("ko-KR")}곳
- 시험 표본: ${summary.sampleCount.toLocaleString("ko-KR")}곳
- 엄격 일치: ${summary.strictMatchCount.toLocaleString("ko-KR")}곳
- 검색 결과는 있으나 엄격 불일치: ${summary.noStrictMatchCount.toLocaleString("ko-KR")}곳
- 동일 주소·좌표의 상호명 변경 의심: ${summary.probableNameChangeCount.toLocaleString("ko-KR")}곳
- 검색 결과 없음: ${summary.noResultCount.toLocaleString("ko-KR")}곳

| 데이터 | 원본 식당 | 판정 | 가장 가까운 검색 결과와 신호 |
| --- | --- | --- | --- |
${rows}

> 이 보고서는 교차 검증 통계일 뿐이며 운영 후보나 원본 JSON을 변경하지 않습니다.
`;
}

async function writeFileAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}

async function writeReport(report, outputDirectory) {
  const directory = resolve(outputDirectory);
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = formatNaverCrossCheckMarkdown(report);
  await writeFileAtomic(resolve(directory, `${timestamp}.json`), json);
  await writeFileAtomic(resolve(directory, `${timestamp}.md`), markdown);
  await writeFileAtomic(resolve(directory, "latest.json"), json);
  await writeFileAtomic(resolve(directory, "latest.md"), markdown);
  return resolve(directory, "latest.md");
}

function parsePositiveInteger(value, name, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name}은 1~${maximum} 사이의 정수여야 합니다.`);
  }
  return number;
}

async function main() {
  const clientId = process.env.NAVER_API_HUB_CLIENT_ID;
  const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "NAVER_API_HUB_CLIENT_ID와 NAVER_API_HUB_CLIENT_SECRET을 .env.local에 설정해 주세요.",
    );
  }

  const sourceArgument = readArgument("source", "all");
  const sourceKeys =
    sourceArgument === "all" ? Object.keys(DATASETS) : [sourceArgument];
  if (sourceKeys.some((source) => !DATASETS[source])) {
    throw new Error(
      `--source는 all, ${Object.keys(DATASETS).join(", ")} 중 하나여야 합니다.`,
    );
  }
  const limitPerSource = parsePositiveInteger(
    readArgument("limit-per-source", String(DEFAULT_LIMIT_PER_SOURCE)),
    "--limit-per-source",
    MAX_LIMIT_PER_SOURCE,
  );
  const maxDistanceMeters = parsePositiveInteger(
    readArgument("max-distance", String(DEFAULT_MAX_DISTANCE_METERS)),
    "--max-distance",
    500,
  );
  const delayMilliseconds = Number(readArgument("delay", "100"));
  if (!Number.isFinite(delayMilliseconds) || delayMilliseconds < 0) {
    throw new Error("--delay는 0 이상의 숫자여야 합니다.");
  }
  const requestedIds = readArgument("ids")
    .split(",")
    .map((id) => id.trim())
    .filter((id, index, ids) => id && ids.indexOf(id) === index);
  if (requestedIds.length > MAX_LIMIT_PER_SOURCE) {
    throw new Error(`--ids는 최대 ${MAX_LIMIT_PER_SOURCE}개까지 지정할 수 있습니다.`);
  }
  if (requestedIds.length > 0 && sourceKeys.length !== 1) {
    throw new Error("--ids를 사용할 때는 --source도 하나만 지정해야 합니다.");
  }

  const sources = [];
  let requestCount = 0;
  for (const source of sourceKeys) {
    const config = DATASETS[source];
    const restaurants = JSON.parse(
      await readFile(resolve(config.path), "utf8"),
    );
    const eligible = restaurants.filter(
      (restaurant) => !isStrictlyKakaoConfirmed(restaurant),
    );
    const selected =
      requestedIds.length > 0
        ? selectCandidatesByIds(eligible, requestedIds)
        : selectEvenlySpacedCandidates(
            eligible,
            Math.min(limitPerSource, eligible.length),
          );
    if (requestedIds.length > 0 && selected.length !== requestedIds.length) {
      const selectedIds = new Set(selected.map(({ id }) => String(id)));
      const missingIds = requestedIds.filter((id) => !selectedIds.has(id));
      throw new Error(
        `카카오 미확인 후보에서 찾지 못한 ID: ${missingIds.join(", ")}`,
      );
    }
    const samples = [];

    for (const [index, restaurant] of selected.entries()) {
      const queries = buildSearchQueries(restaurant);
      let response = null;
      const attemptedQueries = [];
      for (const query of queries) {
        response = await requestNaverLocalSearch(
          query,
          clientId,
          clientSecret,
        );
        requestCount += 1;
        attemptedQueries.push(query);
        if ((response?.items ?? []).length > 0) break;
      }
      const { match, candidates } = selectNaverLocalMatch(
        response?.items ?? [],
        restaurant,
        maxDistanceMeters,
      );
      const status = match
        ? "strict-match"
        : candidates.length > 0
          ? "no-strict-match"
          : "no-result";
      samples.push({
        restaurant: {
          id: String(restaurant.id),
          name: restaurant.name,
          address: restaurant.address,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          kakaoVerificationStatus:
            restaurant.placeVerification?.status ?? "unchecked",
        },
        queries: attemptedQueries,
        status,
        resultCount: candidates.length,
        match,
        candidates,
      });
      console.log(
        `${config.label} ${index + 1}/${selected.length}: ${restaurant.name} · ${status}`,
      );
      if (delayMilliseconds > 0 && index + 1 < selected.length) {
        await wait(delayMilliseconds);
      }
    }

    sources.push({
      source,
      label: config.label,
      sourceCount: restaurants.length,
      eligibleCount: eligible.length,
      sampleCount: samples.length,
      samples,
    });
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: "naver-api-hub-local-search",
    policy: {
      exactNormalizedName: true,
      compatibleAddress: true,
      maxDistanceMeters,
      mutatesSourceData: false,
    },
    sources,
    summary: summarizeNaverCrossCheckResults(sources, requestCount),
  };
  const reportPath = await writeReport(
    report,
    readArgument("output-dir", DEFAULT_OUTPUT_DIRECTORY),
  );
  console.log(`보고서: ${reportPath}`);
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
