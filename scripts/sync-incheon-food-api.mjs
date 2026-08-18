import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createDataUpdateReport,
  printDataUpdateReportSummary,
  writeDataUpdateReport,
} from "./data-update-report.mjs";
import { normalizeText, parsePrice } from "./sync-good-price-api.mjs";

const API_BASE_URL = "https://incheon.openapi.redtable.global";
const RESTAURANT_PATH = "/api/rstr/korean";
const MENU_PATH = "/api/menu/korean";
const DEFAULT_DATA_PATH = "public/data/incheon-restaurants.json";
const PAGE_SIZE = 1_000;

const wait = (milliseconds) =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

function cleanText(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).normalize("NFKC").trim()
    : "";
}

function normalizeServiceKey(value) {
  try {
    return value.includes("%") ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
}

export function findIncheonDistrict(...values) {
  const text = values.map(cleanText).join(" ");
  return (
    text.match(
      /(미추홀구|연수구|남동구|부평구|계양구|강화군|옹진군|중구|동구|서구)/,
    )?.[1] ?? "인천"
  );
}

export function inferIncheonCategory(restaurant, menus = []) {
  const businessType = normalizeText(
    `${cleanText(restaurant?.BIZ_CRTFCT_BZSTAT_NM)} ${cleanText(restaurant?.BIZ_LCPMT_NM)}`,
  );
  const menuText = normalizeText(
    menus.map((menu) => cleanText(menu?.MENU_NM)).join(" "),
  );
  if (/한식/.test(businessType)) return "한식";
  if (/중식|중국/.test(businessType)) return "중식";
  if (/일식|일본/.test(businessType)) return "일식";
  if (/양식/.test(businessType)) return "양식";

  if (/중식|중국|짜장|자장|짬뽕|마라|탕수육|양꼬치/.test(menuText)) {
    return "중식";
  }
  if (
    /일식|일본|초밥|스시|사시미|돈카츠|돈까스|라멘|우동/.test(menuText)
  ) {
    return "일식";
  }
  if (/양식|이탈리|파스타|피자|스테이크|프렌치|브런치/.test(menuText)) {
    return "양식";
  }
  if (
    /한식|한정식|국밥|백반|찌개|갈비|삼겹살|냉면|설렁탕|곰탕|보쌈|족발|칼국수/.test(
      menuText,
    )
  ) {
    return "한식";
  }

  return "기타요식업";
}

export function isIncheonMealMenu(name, price) {
  const menuName = normalizeText(name);
  if (!menuName || price < 1_000 || price > 1_000_000) {
    return false;
  }

  return !/공기밥|사리|추가|곱빼기|곱배기|토핑|소스|음료|콜라|사이다|주류|소주|맥주|막걸리|청하|백세주|산사춘|복분자|고량주|와인/.test(
    menuName,
  );
}

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 36.8 &&
    latitude <= 38.2 &&
    longitude >= 124 &&
    longitude <= 128
  );
}

function adaptMenus(rows) {
  const menusByRestaurant = new Map();

  for (const row of rows) {
    const restaurantId = cleanText(row?.RSTR_ID);
    const name = cleanText(row?.MENU_NM);
    const price = parsePrice(row?.MENU_PRC);

    if (
      !restaurantId ||
      !name ||
      price === null ||
      !isIncheonMealMenu(name, price)
    ) {
      continue;
    }

    const entry = menusByRestaurant.get(restaurantId) ?? {
      rows: [],
      menus: [],
      keys: new Set(),
    };
    const key = `${normalizeText(name)}|${price}`;

    entry.rows.push(row);
    if (!entry.keys.has(key)) {
      entry.menus.push({ name, price });
      entry.keys.add(key);
    }
    menusByRestaurant.set(restaurantId, entry);
  }

  return menusByRestaurant;
}

export function adaptIncheonRows(restaurantRows, menuRows) {
  const menusByRestaurant = adaptMenus(menuRows);
  const restaurants = [];

  for (const row of restaurantRows) {
    const restaurantId = cleanText(row?.RSTR_ID);
    const restaurantName = cleanText(row?.RSTR_NM);
    const branchName = cleanText(row?.BRNCH_NM);
    const name = branchName
      ? `${restaurantName} ${branchName}`.trim()
      : restaurantName;
    const address = cleanText(row?.ROAD_NM_ADDR) || cleanText(row?.LOTNO_ADDR);
    const latitude = Number(row?.RSTR_LAT);
    const longitude = Number(row?.RSTR_LOT);
    const menuEntry = menusByRestaurant.get(restaurantId);
    const menus = menuEntry?.menus ?? [];

    if (
      !restaurantId ||
      !name ||
      !address ||
      !isValidCoordinate(latitude, longitude) ||
      menus.length === 0
    ) {
      continue;
    }

    const phone = cleanText(row?.RSTR_RPRS_TELNO);
    const district = findIncheonDistrict(
      address,
      row?.LOTNO_ADDR,
      menuEntry?.rows?.[0]?.RGN_NM,
    );

    restaurants.push({
      id: `incheon-${restaurantId}`,
      name,
      category: inferIncheonCategory(row, menuEntry?.rows),
      province: "인천광역시",
      district,
      ...(phone ? { phone } : {}),
      address,
      latitude,
      longitude,
      menus: menus.sort((left, right) => left.price - right.price),
    });
  }

  return restaurants;
}

export function preserveKakaoPlaces(restaurants, existingRestaurants) {
  const existingById = new Map(
    existingRestaurants.map((restaurant) => [restaurant.id, restaurant]),
  );

  return restaurants.map((restaurant) => {
    const existing = existingById.get(restaurant.id);
    if (
      !existing?.kakaoPlaceId &&
      !existing?.kakaoPlaceUrl &&
      !existing?.placeVerification
    ) {
      return restaurant;
    }

    return {
      ...restaurant,
      ...(existing.kakaoPlaceId
        ? { kakaoPlaceId: existing.kakaoPlaceId }
        : {}),
      ...(existing.kakaoPlaceUrl
        ? { kakaoPlaceUrl: existing.kakaoPlaceUrl }
        : {}),
      ...(existing.placeVerification
        ? { placeVerification: existing.placeVerification }
        : {}),
    };
  });
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url);

    if (response.ok) {
      return response.json();
    }

    const rawError = await response.text();
    const canRetry = response.status === 429 || response.status >= 500;
    if (!canRetry || attempt === retries) {
      let message = rawError;
      try {
        const parsed = JSON.parse(rawError);
        message = parsed?.msg || parsed?.message || rawError;
      } catch {
        // 응답 본문이 JSON이 아니면 원문 일부를 사용합니다.
      }
      throw new Error(
        `인천 스마트음식관광 API 요청에 실패했습니다. (${response.status})${message ? ` ${message.slice(0, 160)}` : ""}`,
      );
    }

    await wait(500 * 2 ** attempt);
  }
}

async function fetchAllPages(path, serviceKey, label) {
  const rows = [];
  let page = 1;
  let totalCount = Infinity;

  while (rows.length < totalCount) {
    const url = new URL(path, API_BASE_URL);
    url.searchParams.set("serviceKey", normalizeServiceKey(serviceKey));
    url.searchParams.set("pageNo", String(page));

    const response = await fetchJson(url);
    const header = response?.header;
    const body = response?.body;

    if (String(header?.resultCode) !== "00" || !Array.isArray(body)) {
      throw new Error(
        `${label} API 응답 형식이 올바르지 않습니다. ${cleanText(header?.resultMsg) || "토큰과 API 상태를 확인해 주세요."}`,
      );
    }

    rows.push(...body);
    totalCount = Number(header.totalCount ?? rows.length);
    console.log(
      `${label} ${rows.length.toLocaleString("ko-KR")}/${totalCount.toLocaleString("ko-KR")}건`,
    );

    if (body.length === 0 || body.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return rows;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rename(temporaryPath, path);
      return;
    } catch (error) {
      const isTemporaryWindowsLock = ["EPERM", "EACCES", "EBUSY"].includes(
        error?.code,
      );
      if (!isTemporaryWindowsLock || attempt === 9) throw error;
      await wait(100 * (attempt + 1));
    }
  }
}

async function main() {
  const serviceKey = process.env.INCHEON_FOOD_API_TOKEN;
  if (!serviceKey) {
    throw new Error(
      "INCHEON_FOOD_API_TOKEN이 없습니다. .env.local에 발급받은 토큰을 입력해 주세요.",
    );
  }

  const dataPath = resolve(readArgument("data", DEFAULT_DATA_PATH));
  const existingRestaurants = await readJson(dataPath, []);
  const restaurantRows = await fetchAllPages(
    RESTAURANT_PATH,
    serviceKey,
    "매장 기본정보",
  );
  const menuRows = await fetchAllPages(MENU_PATH, serviceKey, "메뉴정보");
  const adaptedRestaurants = adaptIncheonRows(restaurantRows, menuRows);
  const restaurants = preserveKakaoPlaces(
    adaptedRestaurants,
    existingRestaurants,
  );

  const minimumSafeCount = Math.floor(existingRestaurants.length * 0.5);
  if (existingRestaurants.length > 0 && restaurants.length < minimumSafeCount) {
    throw new Error(
      `변환 결과가 ${restaurants.length}건으로 기존 데이터의 절반보다 적어 파일을 덮어쓰지 않았습니다. API 응답을 확인해 주세요.`,
    );
  }
  if (restaurants.length === 0) {
    throw new Error(
      "앱에서 사용할 수 있는 인천 식당이 한 곳도 없어 파일을 저장하지 않았습니다.",
    );
  }

  const updateReport = createDataUpdateReport({
    source: "incheon-smart-food",
    previousRestaurants: existingRestaurants,
    nextRestaurants: restaurants,
    input: {
      origin: "incheon-api",
      fetchedRestaurantRows: restaurantRows.length,
      fetchedMenuRows: menuRows.length,
      normalizedRestaurants: adaptedRestaurants.length,
      excludedDuringTransform: Math.max(
        0,
        restaurantRows.length - adaptedRestaurants.length,
      ),
    },
  });

  await writeJsonAtomic(dataPath, restaurants);
  const reportPaths = await writeDataUpdateReport(updateReport);
  console.log(
    `완료: 매장 ${restaurantRows.length.toLocaleString("ko-KR")}건 + 메뉴 ${menuRows.length.toLocaleString("ko-KR")}건 → 앱용 ${restaurants.length.toLocaleString("ko-KR")}건`,
  );
  printDataUpdateReportSummary(updateReport, reportPaths);
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
