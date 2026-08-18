import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  deduplicateRestaurants,
  isStrictlyKakaoConfirmed,
} from "./deduplicate-restaurants.mjs";

const REPORT_VERSION = 1;
const DEFAULT_REPORT_DIRECTORY = ".cache/data-update-reports";
const MAX_MARKDOWN_CHANGE_ITEMS = 100;

const SOURCE_LABELS = {
  "good-price": "착한가격업소",
  "incheon-smart-food": "인천 스마트음식관광",
};

const COMPARABLE_FIELDS = [
  "name",
  "category",
  "province",
  "district",
  "phone",
  "address",
  "latitude",
  "longitude",
  "menus",
  "kakaoPlaceId",
  "kakaoPlaceUrl",
  "placeVerification",
];

function getComparableField(restaurant, field) {
  if (field !== "placeVerification") return restaurant?.[field] ?? null;
  const verification = restaurant?.placeVerification;
  if (!verification) return null;
  return {
    provider: verification.provider ?? null,
    status: verification.status ?? null,
    matchedBy: verification.matchedBy ?? null,
    distanceMeters: verification.distanceMeters ?? null,
  };
}

function getChangedFields(previous, next) {
  return COMPARABLE_FIELDS.filter(
    (field) =>
      JSON.stringify(getComparableField(previous, field)) !==
      JSON.stringify(getComparableField(next, field)),
  );
}

function toRestaurantSummary(restaurant) {
  return {
    id: String(restaurant.id),
    name: String(restaurant.name ?? ""),
    address: String(restaurant.address ?? ""),
    ...(restaurant.kakaoPlaceId
      ? { kakaoPlaceId: String(restaurant.kakaoPlaceId) }
      : {}),
  };
}

function countVerificationStatuses(restaurants) {
  let confirmed = 0;
  let failed = 0;
  let unchecked = 0;

  for (const restaurant of restaurants) {
    if (isStrictlyKakaoConfirmed(restaurant)) {
      confirmed += 1;
    } else if (
      restaurant?.placeVerification?.provider === "kakao" &&
      restaurant?.placeVerification?.status === "unverified"
    ) {
      failed += 1;
    } else {
      unchecked += 1;
    }
  }

  return { confirmed, failed, unchecked };
}

function getOperationalStats(restaurants) {
  const confirmedRestaurants = restaurants.filter(isStrictlyKakaoConfirmed);
  const deduplicated = deduplicateRestaurants(confirmedRestaurants);
  return {
    verificationEligible: confirmedRestaurants.length,
    excludedByVerification: restaurants.length - confirmedRestaurants.length,
    duplicateGroups: deduplicated.groups.length,
    duplicatesRemoved: deduplicated.removedCount,
    finalCandidates: deduplicated.restaurants.length,
  };
}

function assertRestaurantArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 식당 데이터는 배열이어야 합니다.`);
  }
}

export function createDataUpdateReport({
  source,
  previousRestaurants,
  nextRestaurants,
  input = {},
  generatedAt = new Date().toISOString(),
}) {
  if (!SOURCE_LABELS[source]) {
    throw new Error(`지원하지 않는 데이터 소스입니다: ${source}`);
  }
  assertRestaurantArray(previousRestaurants, "갱신 전");
  assertRestaurantArray(nextRestaurants, "갱신 후");

  const previousById = new Map(
    previousRestaurants.map((restaurant) => [String(restaurant.id), restaurant]),
  );
  const nextById = new Map(
    nextRestaurants.map((restaurant) => [String(restaurant.id), restaurant]),
  );
  const added = [];
  const removed = [];
  const changed = [];
  let unchanged = 0;

  for (const restaurant of nextRestaurants) {
    const previous = previousById.get(String(restaurant.id));
    if (!previous) {
      added.push(toRestaurantSummary(restaurant));
      continue;
    }
    const changedFields = getChangedFields(previous, restaurant);
    if (changedFields.length === 0) {
      unchanged += 1;
    } else {
      changed.push({
        ...toRestaurantSummary(restaurant),
        changedFields,
      });
    }
  }

  for (const restaurant of previousRestaurants) {
    if (!nextById.has(String(restaurant.id))) {
      removed.push(toRestaurantSummary(restaurant));
    }
  }

  return {
    version: REPORT_VERSION,
    source,
    sourceLabel: SOURCE_LABELS[source],
    generatedAt,
    input,
    summary: {
      previousTotal: previousRestaurants.length,
      nextTotal: nextRestaurants.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
    },
    verification: {
      previous: countVerificationStatuses(previousRestaurants),
      next: countVerificationStatuses(nextRestaurants),
    },
    operationalCandidates: {
      previous: getOperationalStats(previousRestaurants),
      next: getOperationalStats(nextRestaurants),
    },
    changes: { added, removed, changed },
  };
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function formatChangeItems(items) {
  if (items.length === 0) return "- 없음";
  const visibleItems = items.slice(0, MAX_MARKDOWN_CHANGE_ITEMS);
  const lines = visibleItems.map((item) => {
    const fields = item.changedFields?.length
      ? ` · 변경 필드: ${item.changedFields.join(", ")}`
      : "";
    return `- \`${item.id}\` ${item.name}${fields}`;
  });
  if (items.length > visibleItems.length) {
    lines.push(`- 그 외 ${formatNumber(items.length - visibleItems.length)}곳은 JSON 보고서에서 확인`);
  }
  return lines.join("\n");
}

export function formatDataUpdateReportMarkdown(report) {
  const { summary, verification, operationalCandidates, input } = report;
  const excludedDuringTransform = Number(input.excludedDuringTransform ?? 0);
  return `# ${report.sourceLabel} 데이터 갱신 보고서

- 생성 시각: ${report.generatedAt}
- 갱신 경로: ${input.origin ?? "unknown"}

## 갱신 요약

| 항목 | 건수 |
| --- | ---: |
| 갱신 전 | ${formatNumber(summary.previousTotal)} |
| 갱신 후 | ${formatNumber(summary.nextTotal)} |
| 신규 | ${formatNumber(summary.added)} |
| 기존 데이터에서 제외 | ${formatNumber(summary.removed)} |
| 변환 단계에서 제외 | ${formatNumber(excludedDuringTransform)} |
| 내용 변경 | ${formatNumber(summary.changed)} |
| 변경 없음 | ${formatNumber(summary.unchanged)} |

## 카카오 검증과 운영 후보

| 항목 | 갱신 전 | 갱신 후 |
| --- | ---: | ---: |
| 엄격 확인 | ${formatNumber(verification.previous.confirmed)} | ${formatNumber(verification.next.confirmed)} |
| 매칭 실패 | ${formatNumber(verification.previous.failed)} | ${formatNumber(verification.next.failed)} |
| 미검사 | ${formatNumber(verification.previous.unchecked)} | ${formatNumber(verification.next.unchecked)} |
| 검증 상태로 운영 제외 | ${formatNumber(operationalCandidates.previous.excludedByVerification)} | ${formatNumber(operationalCandidates.next.excludedByVerification)} |
| 중복 병합 | ${formatNumber(operationalCandidates.previous.duplicatesRemoved)} | ${formatNumber(operationalCandidates.next.duplicatesRemoved)} |
| 최종 운영 후보 | ${formatNumber(operationalCandidates.previous.finalCandidates)} | ${formatNumber(operationalCandidates.next.finalCandidates)} |

## 신규 식당

${formatChangeItems(report.changes.added)}

## 제외된 식당

${formatChangeItems(report.changes.removed)}

## 변경된 식당

${formatChangeItems(report.changes.changed)}
`;
}

async function writeFileAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
}

function toSafeTimestamp(value) {
  return value.replace(/[:.]/g, "-");
}

export async function writeDataUpdateReport(
  report,
  { directory = DEFAULT_REPORT_DIRECTORY } = {},
) {
  const sourceDirectory = resolve(directory, report.source);
  const timestamp = toSafeTimestamp(report.generatedAt);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = formatDataUpdateReportMarkdown(report);
  const paths = {
    latestJson: resolve(sourceDirectory, "latest.json"),
    latestMarkdown: resolve(sourceDirectory, "latest.md"),
    historyJson: resolve(sourceDirectory, `${timestamp}.json`),
    historyMarkdown: resolve(sourceDirectory, `${timestamp}.md`),
  };

  await writeFileAtomic(paths.historyJson, json);
  await writeFileAtomic(paths.historyMarkdown, markdown);
  await writeFileAtomic(paths.latestJson, json);
  await writeFileAtomic(paths.latestMarkdown, markdown);
  return paths;
}

export function printDataUpdateReportSummary(report, paths) {
  const { summary, verification, operationalCandidates, input } = report;
  console.log(
    `갱신 보고서: 신규 ${formatNumber(summary.added)} · 기존 데이터 제외 ${formatNumber(summary.removed)} · 변환 제외 ${formatNumber(input.excludedDuringTransform)} · 변경 ${formatNumber(summary.changed)}`,
  );
  console.log(
    `카카오 확인 ${formatNumber(verification.next.confirmed)} · 매칭 실패 ${formatNumber(verification.next.failed)} · 미검사 ${formatNumber(verification.next.unchecked)} · 최종 운영 후보 ${formatNumber(operationalCandidates.next.finalCandidates)}`,
  );
  console.log(`상세 보고서: ${paths.latestMarkdown}`);
}
