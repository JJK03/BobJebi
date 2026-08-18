import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { selectKakaoPlaceMatch } from "./enrich-kakao-places.mjs";

const DEFAULT_DATA_PATH = "public/data/restaurants.json";
const DEFAULT_CACHE_PATH = ".cache/good-price-geocoding.json";
const PAGE_SIZE = 1_000;
const KAKAO_ADDRESS_URL =
  "https://dapi.kakao.com/v2/local/search/address.json";
const KAKAO_KEYWORD_URL =
  "https://dapi.kakao.com/v2/local/search/keyword.json";

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

export function normalizeText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

export function parsePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  }

  const normalized = cleanText(value).replace(/,/g, "");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const price = Number(match[0]);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : null;
}

export function normalizeCategory(value) {
  const category = normalizeText(value);

  if (category.startsWith("한식")) return "한식";
  if (category.startsWith("중식")) return "중식";
  if (category.startsWith("일식")) return "일식";
  if (category.startsWith("양식")) return "양식";
  if (
    category.includes("기타요식") ||
    category.includes("기타외식") ||
    category === "카페"
  ) {
    return "기타요식업";
  }

  return null;
}

function createSourceKey({ province, district, name, address }) {
  return [province, district, name, address].map(normalizeText).join("|");
}

function createNameAddressKey({ name, address }) {
  return [name, address].map(normalizeText).join("|");
}

function createPhoneKey({ province, district, name, phone }) {
  if (!phone) return "";
  return [province, district, name, phone].map(normalizeText).join("|");
}

function createNameDistrictKey({ province, district, name }) {
  return [province, district, name].map(normalizeText).join("|");
}

export function adaptGoodPriceRow(row) {
  if (typeof row !== "object" || row === null) {
    return null;
  }

  const category = normalizeCategory(row["업종"]);
  const province = cleanText(row["시도"]);
  const district = cleanText(row["시군"]);
  const name = cleanText(row["업소명"]);
  const phone = cleanText(row["연락처"]);
  const address = cleanText(row["주소"]);

  if (!category || !province || !district || !name || !address) {
    return null;
  }

  const menus = [];
  const menuKeys = new Set();

  for (let index = 1; index <= 4; index += 1) {
    const menuName = cleanText(row[`메뉴${index}`]);
    const price = parsePrice(row[`가격${index}`]);

    if (!menuName || price === null) {
      continue;
    }

    const menuKey = `${normalizeText(menuName)}|${price}`;
    if (!menuKeys.has(menuKey)) {
      menus.push({ name: menuName, price });
      menuKeys.add(menuKey);
    }
  }

  if (menus.length === 0) {
    return null;
  }

  return {
    province,
    district,
    name,
    ...(phone ? { phone } : {}),
    address,
    category,
    menus,
  };
}

function addUniqueLookupValue(map, key, restaurant) {
  if (!key) return;
  if (!map.has(key)) {
    map.set(key, restaurant);
    return;
  }
  map.set(key, null);
}

export function createExistingLookup(restaurants) {
  const source = new Map();
  const nameAddress = new Map();
  const phone = new Map();
  const nameDistrict = new Map();

  for (const restaurant of restaurants) {
    addUniqueLookupValue(source, createSourceKey(restaurant), restaurant);
    addUniqueLookupValue(
      nameAddress,
      createNameAddressKey(restaurant),
      restaurant,
    );
    addUniqueLookupValue(phone, createPhoneKey(restaurant), restaurant);
    addUniqueLookupValue(
      nameDistrict,
      createNameDistrictKey(restaurant),
      restaurant,
    );
  }

  return { source, nameAddress, phone, nameDistrict };
}

export function findExistingRestaurant(lookup, restaurant) {
  return (
    lookup.source.get(createSourceKey(restaurant)) ||
    lookup.nameAddress.get(createNameAddressKey(restaurant)) ||
    lookup.phone.get(createPhoneKey(restaurant)) ||
    lookup.nameDistrict.get(createNameDistrictKey(restaurant)) ||
    null
  );
}

function createRestaurantId(restaurant) {
  return createHash("sha256")
    .update(createSourceKey(restaurant))
    .digest("hex")
    .slice(0, 20);
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

async function fetchJson(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, options);

    if (response.ok) {
      return response.json();
    }

    const canRetry = response.status === 429 || response.status >= 500;
    if (!canRetry || attempt === retries) {
      throw new Error(`API 요청에 실패했습니다. (${response.status})`);
    }

    await wait(500 * 2 ** attempt);
  }
}

function normalizeServiceKey(value) {
  try {
    return value.includes("%") ? decodeURIComponent(value) : value;
  } catch {
    return value;
  }
}

async function fetchGoodPriceRows(endpoint, serviceKey) {
  const rows = [];
  let page = 1;
  let totalCount = Infinity;

  while (rows.length < totalCount) {
    const url = new URL(endpoint);
    url.searchParams.set("page", String(page));
    url.searchParams.set("perPage", String(PAGE_SIZE));
    url.searchParams.set("returnType", "JSON");
    url.searchParams.set("serviceKey", normalizeServiceKey(serviceKey));

    const body = await fetchJson(url);
    if (!Array.isArray(body?.data)) {
      throw new Error(
        "착한가격업소 API 응답에 data 배열이 없습니다. API URL과 인증키를 확인해 주세요.",
      );
    }

    rows.push(...body.data);
    totalCount = Number(body.totalCount ?? rows.length);
    console.log(
      `API 수집 ${rows.length.toLocaleString("ko-KR")}/${totalCount.toLocaleString("ko-KR")}건`,
    );

    if (body.data.length === 0) break;
    page += 1;
  }

  return rows;
}

async function callKakao(url, apiKey) {
  return fetchJson(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
}

async function geocodeRestaurant(restaurant, apiKey) {
  const addressUrl = new URL(KAKAO_ADDRESS_URL);
  addressUrl.searchParams.set("query", restaurant.address);
  const addressBody = await callKakao(addressUrl, apiKey);
  const addressMatch = addressBody?.documents?.[0];

  if (!addressMatch) return null;

  const latitude = Number(addressMatch.y);
  const longitude = Number(addressMatch.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const keywordUrl = new URL(KAKAO_KEYWORD_URL);
  keywordUrl.searchParams.set("query", restaurant.name);
  keywordUrl.searchParams.set("x", String(longitude));
  keywordUrl.searchParams.set("y", String(latitude));
  keywordUrl.searchParams.set("radius", "2000");
  keywordUrl.searchParams.set("size", "15");
  keywordUrl.searchParams.set("sort", "distance");
  const keywordBody = await callKakao(keywordUrl, apiKey);
  const match = selectKakaoPlaceMatch(
    keywordBody?.documents ?? [],
    restaurant,
  );
  const place = match?.place;
  const checkedAt = new Date().toISOString();

  return {
    latitude,
    longitude,
    ...(place?.id ? { kakaoPlaceId: String(place.id) } : {}),
    ...(place?.place_url
      ? { kakaoPlaceUrl: String(place.place_url).replace(/^http:/, "https:") }
      : {}),
    placeVerification: match
      ? {
          provider: "kakao",
          status: "confirmed",
          matchedBy: match.matchedBy,
          distanceMeters: match.distanceMeters,
          checkedAt,
        }
      : {
          provider: "kakao",
          status: "unverified",
          checkedAt,
        },
  };
}

export function mergeWithLocation(source, existing, location) {
  return {
    id: existing?.id ?? createRestaurantId(source),
    name: source.name,
    category: source.category,
    province: source.province,
    district: source.district,
    ...(source.phone ? { phone: source.phone } : {}),
    address: source.address,
    latitude: existing?.latitude ?? location.latitude,
    longitude: existing?.longitude ?? location.longitude,
    menus: source.menus,
    ...(existing?.kakaoPlaceId || location.kakaoPlaceId
      ? { kakaoPlaceId: existing?.kakaoPlaceId ?? location.kakaoPlaceId }
      : {}),
    ...(existing?.kakaoPlaceUrl || location.kakaoPlaceUrl
      ? { kakaoPlaceUrl: existing?.kakaoPlaceUrl ?? location.kakaoPlaceUrl }
      : {}),
    ...(existing?.placeVerification || location.placeVerification
      ? {
          placeVerification:
            existing?.placeVerification ?? location.placeVerification,
        }
      : {}),
  };
}

async function main() {
  const endpoint = process.env.GOOD_PRICE_API_URL;
  const serviceKey = process.env.DATA_GO_KR_API_KEY;
  const kakaoApiKey = process.env.KAKAO_REST_API_KEY;

  if (!endpoint || !serviceKey) {
    throw new Error(
      "GOOD_PRICE_API_URL 또는 DATA_GO_KR_API_KEY가 없습니다. .env.local을 확인해 주세요.",
    );
  }

  const dataPath = resolve(readArgument("data", DEFAULT_DATA_PATH));
  const cachePath = resolve(readArgument("cache", DEFAULT_CACHE_PATH));
  const delayMilliseconds = Number(readArgument("delay", "100"));
  const existingRestaurants = await readJson(dataPath, []);
  const geocodingCache = await readJson(cachePath, {});

  if (!Array.isArray(existingRestaurants)) {
    throw new Error("기존 식당 데이터는 배열이어야 합니다.");
  }

  const rows = await fetchGoodPriceRows(endpoint, serviceKey);
  const adapted = rows.map(adaptGoodPriceRow).filter(Boolean);
  const sourceByKey = new Map();
  for (const restaurant of adapted) {
    sourceByKey.set(createSourceKey(restaurant), restaurant);
  }

  const sources = [...sourceByKey.values()];
  const lookup = createExistingLookup(existingRestaurants);
  const restaurants = [];
  let preservedCount = 0;
  let geocodedCount = 0;
  let skippedCount = 0;

  for (const [index, source] of sources.entries()) {
    const existing = findExistingRestaurant(lookup, source);
    let location = existing;

    if (existing) {
      preservedCount += 1;
    } else {
      const cacheKey = createSourceKey(source);
      location = geocodingCache[cacheKey] ?? null;

      if (!location && kakaoApiKey) {
        location = await geocodeRestaurant(source, kakaoApiKey);
        if (location) {
          geocodingCache[cacheKey] = location;
          geocodedCount += 1;
          await writeJsonAtomic(cachePath, geocodingCache);
        }
        if (delayMilliseconds > 0) await wait(delayMilliseconds);
      }
    }

    if (!location) {
      skippedCount += 1;
      continue;
    }

    restaurants.push(mergeWithLocation(source, existing, location));

    if ((index + 1) % 100 === 0) {
      console.log(
        `변환 ${index + 1}/${sources.length}건 · 좌표 보존 ${preservedCount} · 신규 좌표 ${geocodedCount} · 제외 ${skippedCount}`,
      );
    }
  }

  const minimumSafeCount = Math.floor(existingRestaurants.length * 0.5);
  if (restaurants.length < minimumSafeCount) {
    throw new Error(
      `변환 결과가 ${restaurants.length}건으로 기존 데이터의 절반보다 적어 파일을 덮어쓰지 않았습니다. API URL과 응답 필드를 확인해 주세요.`,
    );
  }

  await writeJsonAtomic(dataPath, restaurants);
  await writeJsonAtomic(cachePath, geocodingCache);

  console.log(
    `완료: API ${rows.length.toLocaleString("ko-KR")}건 → 앱용 ${restaurants.length.toLocaleString("ko-KR")}건`,
  );
  console.log(
    `기존 좌표 보존 ${preservedCount.toLocaleString("ko-KR")}건 · 신규 지오코딩 ${geocodedCount.toLocaleString("ko-KR")}건 · 좌표 없어 제외 ${skippedCount.toLocaleString("ko-KR")}건`,
  );
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
