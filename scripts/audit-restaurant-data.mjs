import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  deduplicateRestaurants,
  isStrictlyKakaoConfirmed,
  normalizeRestaurantAddress,
  normalizeRestaurantName,
} from "./deduplicate-restaurants.mjs";

export { normalizeRestaurantAddress, normalizeRestaurantName };

const DEFAULT_OUTPUT_PATH = ".cache/restaurant-data-audit.json";
const DEFAULT_MAX_SIDE_MENU_PRICE = 10_000;

const DATASETS = {
  "good-price": {
    label: "착한가격업소",
    inputPath: "public/data/restaurants.json",
  },
  "incheon-smart-food": {
    label: "인천 스마트음식관광",
    inputPath: "public/data/incheon-restaurants.json",
  },
};

const SIDE_MENU_RULES = [
  {
    reason: "볶음밥 추가·변경·리필",
    pattern:
      /볶음\s*밥.*(?:추가|변경|교체|리필)|(?:추가|후식|마무리|변경|교체|리필).*볶음\s*밥/i,
  },
  {
    reason: "상차림 비용",
    pattern:
      /^상차림$|상차림\s*(?:비|비용|별도|가격|대|[(/]?\s*(?:1(?:인|人)|한상|소1(?:인|人)|대1(?:인|人)))|1(?:인|人)\s*상차림/i,
  },
  {
    reason: "리필 항목",
    pattern: /(?:^|\s)(?:밥|반찬|육수|면|사리|소스)?\s*리필(?:\s*(?:비|가격))?(?:$|\s)/i,
  },
  {
    reason: "메뉴 변경·교체 비용",
    pattern:
      /(?:메뉴|사이즈|밥|면|사리|음료)\s*(?:변경|교체)|(?:변경|교체)\s*(?:비|가격)/i,
  },
];

const CATEGORY_RULES = [
  {
    category: "샐러드·브런치",
    pattern: /샐러드|브런치|샌드위치|sandwich|산도/i,
  },
  {
    category: "치킨·피자",
    pattern: /치킨|통닭|닭강정|피자|햄버거|버거|프라이드치킨/i,
  },
  {
    category: "분식·간편식",
    pattern:
      /분식|김밥|떡볶이|순대(?!국)|어묵|오뎅|라볶이|토스트|핫도그|닭꼬치|떡꼬치|만두|브리또|부리또/i,
  },
  {
    category: "베이커리·디저트",
    pattern:
      /베이커리|제과|제빵|빵집|브레드|베이글|도넛|크루아상|꽈배기|마카롱|케이크|와플|아이스크림|빙수|젤라또|디저트|쿠키|휘낭시에|스콘|타르트|떡집|떡방/i,
  },
  { category: "뷔페", pattern: /뷔페|부페|buffet/i },
  {
    category: "아시아음식",
    pattern: /쌀국수|마라|샤브|월남쌈|타코|케밥|팟타이|나시고랭|인도커리|똠얌|반미/i,
  },
  {
    category: "중식",
    pattern: /짜장|자장|짬뽕|탕수육|깐풍|유산슬|양장피|중화요리|중국집/i,
  },
  {
    category: "일식",
    pattern: /마제소바|초밥|스시|우동|돈가스|돈까스|돈카츠|라멘|사시미|일식/i,
  },
  {
    category: "주점·안주",
    pattern: /포차|호프|주점|펍|pub|술집|먹태|노가리|짝태|이자카야|오뎅바|안주/i,
  },
  {
    category: "해산물·회",
    pattern:
      /꼼장어|곰장어|장어|횟집|모듬회|생선회|회덮밥|사시미|광어|우럭|연어|참치|낙지|오징어|주꾸미|쭈꾸미|문어|조개|굴|해물|아귀|복어|대게|꽃게|게장|새우|생선/i,
  },
  {
    category: "고기·구이",
    pattern:
      /곱창|막창|대창|고깃집|고기집|숯불|직화|삼겹|갈비|불고기|육회|닭갈비|오리|바비큐|바베큐|스테이크|제육|두루치기|돼지껍데기/i,
  },
  {
    category: "양식",
    pattern: /파스타|리조또|라자냐|오믈렛|필라프|양식/i,
  },
  {
    category: "한식",
    pattern: /한식|백반|국밥|찌개|전골|설렁탕|곰탕|칼국수|수제비|냉면|보쌈|족발|비빔밥/i,
  },
];

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function toRestaurantReference(restaurant) {
  return {
    id: String(restaurant.id ?? ""),
    name: String(restaurant.name ?? ""),
    address: String(restaurant.address ?? ""),
    category: String(restaurant.category ?? ""),
    ...(restaurant.kakaoPlaceId
      ? { kakaoPlaceId: String(restaurant.kakaoPlaceId) }
      : {}),
    ...(restaurant.placeVerification
      ? { placeVerification: restaurant.placeVerification }
      : {}),
  };
}

export function findDuplicateGroups(restaurants, keySelector) {
  const groups = new Map();

  for (const restaurant of restaurants) {
    const key = keySelector(restaurant);
    if (!key) continue;
    const entries = groups.get(key) ?? [];
    entries.push(restaurant);
    groups.set(key, entries);
  }

  return [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([key, entries]) => ({
      key,
      count: entries.length,
      restaurants: entries.map(toRestaurantReference),
    }))
    .sort((left, right) =>
      right.count === left.count
        ? left.key.localeCompare(right.key)
        : right.count - left.count,
    );
}

export function getSideMenuSuspicion(menu, maxPrice = DEFAULT_MAX_SIDE_MENU_PRICE) {
  const name = normalizeText(menu?.name);
  const price = Number(menu?.price);
  if (!name || !Number.isFinite(price) || price > maxPrice) {
    return undefined;
  }

  const rule = SIDE_MENU_RULES.find(({ pattern }) => pattern.test(name));
  return rule ? { reason: rule.reason, name, price } : undefined;
}

export function suggestRestaurantCategory(restaurant) {
  const text = normalizeText(
    `${restaurant.name ?? ""} ${(restaurant.menus ?? [])
      .map((menu) => menu?.name ?? "")
      .join(" ")}`,
  );
  const rule = CATEGORY_RULES.find(({ pattern }) => pattern.test(text));
  if (!rule) return undefined;

  const evidence = text.match(rule.pattern)?.[0];
  return {
    category: rule.category,
    ...(evidence ? { evidence } : {}),
  };
}

function isCategoryReviewNeeded(originalCategory, suggestedCategory) {
  return originalCategory !== suggestedCategory;
}

function countBy(items, keySelector) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = keySelector(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort((left, right) =>
      right[1] === left[1]
        ? left[0].localeCompare(right[0])
        : right[1] - left[1],
    ),
  );
}

export function auditRestaurantDataset(
  source,
  inputPath,
  restaurants,
  options = {},
) {
  if (!Array.isArray(restaurants)) {
    throw new Error(`${source} 식당 데이터는 배열이어야 합니다.`);
  }

  const maxSideMenuPrice =
    options.maxSideMenuPrice ?? DEFAULT_MAX_SIDE_MENU_PRICE;
  const kakaoPlaceIdCount = restaurants.filter(
    (restaurant) => Boolean(restaurant.kakaoPlaceId),
  ).length;
  const kakaoConfirmedCount = restaurants.filter(
    (restaurant) =>
      Boolean(restaurant.kakaoPlaceId) &&
      restaurant.placeVerification?.provider === "kakao" &&
      restaurant.placeVerification?.status === "confirmed",
  ).length;
  const kakaoLegacyPlaceIdCount = restaurants.filter(
    (restaurant) =>
      Boolean(restaurant.kakaoPlaceId) && !restaurant.placeVerification,
  ).length;
  const kakaoCheckedUnverifiedCount = restaurants.filter(
    (restaurant) =>
      restaurant.placeVerification?.provider === "kakao" &&
      restaurant.placeVerification?.status === "unverified",
  ).length;
  const kakaoUncheckedCount = restaurants.filter(
    (restaurant) => !restaurant.placeVerification,
  ).length;
  const duplicateKakaoPlaces = findDuplicateGroups(
    restaurants,
    (restaurant) => String(restaurant.kakaoPlaceId ?? "").trim(),
  );
  const duplicateNameAddresses = findDuplicateGroups(restaurants, (restaurant) => {
    const name = normalizeRestaurantName(restaurant.name);
    const address = normalizeRestaurantAddress(restaurant.address);
    return name && address ? `${name}|${address}` : "";
  });
  const deduplication = deduplicateRestaurants(restaurants);
  const verifiedDeduplication = deduplicateRestaurants(
    restaurants.filter(isStrictlyKakaoConfirmed),
  );
  const suspectedSideMenus = [];
  const categoryReviewCandidates = [];

  for (const restaurant of restaurants) {
    for (const menu of restaurant.menus ?? []) {
      const suspicion = getSideMenuSuspicion(menu, maxSideMenuPrice);
      if (suspicion) {
        suspectedSideMenus.push({
          ...toRestaurantReference(restaurant),
          menuName: suspicion.name,
          menuPrice: suspicion.price,
          reason: suspicion.reason,
        });
      }
    }

    const suggestion = suggestRestaurantCategory(restaurant);
    if (
      suggestion &&
      isCategoryReviewNeeded(restaurant.category, suggestion.category)
    ) {
      categoryReviewCandidates.push({
        ...toRestaurantReference(restaurant),
        suggestedCategory: suggestion.category,
        ...(suggestion.evidence ? { evidence: suggestion.evidence } : {}),
      });
    }
  }

  const duplicateKakaoRecordCount = duplicateKakaoPlaces.reduce(
    (sum, group) => sum + group.count,
    0,
  );
  const duplicateNameAddressRecordCount = duplicateNameAddresses.reduce(
    (sum, group) => sum + group.count,
    0,
  );

  return {
    source,
    inputPath,
    summary: {
      totalRestaurants: restaurants.length,
      kakaoPlaceIdRestaurants: kakaoPlaceIdCount,
      kakaoConfirmedRestaurants: kakaoConfirmedCount,
      kakaoUnconfirmedRestaurants: restaurants.length - kakaoConfirmedCount,
      kakaoConfirmedRate:
        restaurants.length === 0
          ? 0
          : Number(((kakaoConfirmedCount / restaurants.length) * 100).toFixed(1)),
      verifiedCandidateRestaurants:
        verifiedDeduplication.restaurants.length,
      verifiedCandidateDuplicatesRemoved: verifiedDeduplication.removedCount,
      kakaoLegacyPlaceIdRestaurants: kakaoLegacyPlaceIdCount,
      kakaoCheckedUnverifiedRestaurants: kakaoCheckedUnverifiedCount,
      kakaoUncheckedRestaurants: kakaoUncheckedCount,
      duplicateKakaoPlaceGroups: duplicateKakaoPlaces.length,
      duplicateKakaoPlaceRecords: duplicateKakaoRecordCount,
      duplicateNameAddressGroups: duplicateNameAddresses.length,
      duplicateNameAddressRecords: duplicateNameAddressRecordCount,
      deduplicatedRestaurants: deduplication.restaurants.length,
      deduplicationGroups: deduplication.groups.length,
      removedDuplicateRecords: deduplication.removedCount,
      deduplicationGroupsByReason: countBy(
        deduplication.groups.flatMap((group) =>
          group.reasons.map((reason) => ({ reason })),
        ),
        ({ reason }) => reason,
      ),
      suspectedSideMenuEntries: suspectedSideMenus.length,
      restaurantsWithSuspectedSideMenus: new Set(
        suspectedSideMenus.map(({ id }) => id),
      ).size,
      suspectedSideMenusByReason: countBy(
        suspectedSideMenus,
        ({ reason }) => reason,
      ),
      categoryReviewCandidates: categoryReviewCandidates.length,
      categoryReviewCandidatesByChange: countBy(
        categoryReviewCandidates,
        ({ category, suggestedCategory }) =>
          `${category} -> ${suggestedCategory}`,
      ),
    },
    details: {
      duplicateKakaoPlaces,
      duplicateNameAddresses,
      deduplicationGroups: deduplication.groups,
      suspectedSideMenus,
      categoryReviewCandidates,
    },
  };
}

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function printDatasetSummary(dataset) {
  const summary = dataset.summary;
  console.log(`\n[${DATASETS[dataset.source].label}]`);
  console.log(`전체 식당: ${summary.totalRestaurants.toLocaleString("ko-KR")}곳`);
  console.log(
    `카카오 장소 ID: ${summary.kakaoPlaceIdRestaurants.toLocaleString("ko-KR")}곳`,
  );
  console.log(
    `엄격 기준 확인: ${summary.kakaoConfirmedRestaurants.toLocaleString("ko-KR")}곳 (${summary.kakaoConfirmedRate}%) · 확인 필요 ${summary.kakaoUnconfirmedRestaurants.toLocaleString("ko-KR")}곳`,
  );
  console.log(
    `기존 기준 ID: ${summary.kakaoLegacyPlaceIdRestaurants.toLocaleString("ko-KR")}곳 · 검사 후 미확인 ${summary.kakaoCheckedUnverifiedRestaurants.toLocaleString("ko-KR")}곳 · 미검사 ${summary.kakaoUncheckedRestaurants.toLocaleString("ko-KR")}곳`,
  );
  console.log(
    `검증 후보 전용 shard 예상: ${summary.verifiedCandidateRestaurants.toLocaleString("ko-KR")}곳 · 확인 후보 중 중복 ${summary.verifiedCandidateDuplicatesRemoved.toLocaleString("ko-KR")}건 병합`,
  );
  console.log(
    `카카오 ID 중복: ${summary.duplicateKakaoPlaceGroups.toLocaleString("ko-KR")}그룹 / ${summary.duplicateKakaoPlaceRecords.toLocaleString("ko-KR")}건`,
  );
  console.log(
    `상호명+주소 중복: ${summary.duplicateNameAddressGroups.toLocaleString("ko-KR")}그룹 / ${summary.duplicateNameAddressRecords.toLocaleString("ko-KR")}건`,
  );
  console.log(
    `실제 병합 예정: ${summary.deduplicationGroups.toLocaleString("ko-KR")}그룹 / ${summary.removedDuplicateRecords.toLocaleString("ko-KR")}건 제거 후 ${summary.deduplicatedRestaurants.toLocaleString("ko-KR")}곳`,
  );
  console.log(
    `저가 사이드 메뉴 의심: ${summary.suspectedSideMenuEntries.toLocaleString("ko-KR")}개 메뉴 / ${summary.restaurantsWithSuspectedSideMenus.toLocaleString("ko-KR")}곳`,
  );
  console.log(
    `카테고리 재검토 후보: ${summary.categoryReviewCandidates.toLocaleString("ko-KR")}곳`,
  );
}

async function main() {
  const selectedSource = readArgument("source");
  if (selectedSource && !DATASETS[selectedSource]) {
    throw new Error(`지원하지 않는 데이터 소스입니다: ${selectedSource}`);
  }

  const maxSideMenuPrice = Number(
    readArgument("max-side-price", String(DEFAULT_MAX_SIDE_MENU_PRICE)),
  );
  if (!Number.isFinite(maxSideMenuPrice) || maxSideMenuPrice < 0) {
    throw new Error("--max-side-price는 0 이상의 숫자여야 합니다.");
  }

  const sources = selectedSource ? [selectedSource] : Object.keys(DATASETS);
  const datasets = [];
  for (const source of sources) {
    const inputPath = resolve(DATASETS[source].inputPath);
    const restaurants = JSON.parse(await readFile(inputPath, "utf8"));
    const audit = auditRestaurantDataset(
      source,
      DATASETS[source].inputPath,
      restaurants,
      { maxSideMenuPrice },
    );
    datasets.push(audit);
    printDatasetSummary(audit);
  }

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    options: { maxSideMenuPrice },
    datasets,
  };
  const outputPath = resolve(readArgument("output", DEFAULT_OUTPUT_PATH));
  await writeJsonAtomic(outputPath, report);
  console.log(`\n상세 보고서: ${outputPath}`);
  console.log("원본 식당 JSON은 변경하지 않았습니다.");
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
