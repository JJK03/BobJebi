import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const KAKAO_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";
const DEFAULT_DATA_PATH = "public/data/restaurants.json";
const DEFAULT_PROGRESS_PATH = ".cache/kakao-place-progress.json";
const MAX_MATCH_DISTANCE_METERS = 500;
const MAX_NAME_ONLY_DISTANCE_METERS = 150;
const CHECKPOINT_INTERVAL = 50;

const wait = (milliseconds) =>
  new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

export function normalizePlaceName(name) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

export function normalizePlaceAddress(address) {
  return String(address ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/인천광역시|인천시|인천/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

export function selectKakaoPlace(
  documents,
  restaurant,
  maxDistanceMeters = MAX_MATCH_DISTANCE_METERS,
) {
  const normalizedRestaurantName = normalizePlaceName(restaurant.name);
  const normalizedRestaurantAddress = normalizePlaceAddress(
    restaurant.address,
  );

  return documents
    .map((document) => ({
      document,
      distance: Number(document.distance),
      exactName:
        normalizePlaceName(document.place_name) === normalizedRestaurantName,
      exactAddress:
        normalizedRestaurantAddress.length > 0 &&
        [document.road_address_name, document.address_name].some(
          (address) =>
            normalizePlaceAddress(address) === normalizedRestaurantAddress,
        ),
      isFoodOrCafe: ["FD6", "CE7"].includes(document.category_group_code),
    }))
    .filter(
      ({ distance, exactName, exactAddress, isFoodOrCafe }) =>
        Number.isFinite(distance) &&
        distance <= maxDistanceMeters &&
        ((exactName && distance <= MAX_NAME_ONLY_DISTANCE_METERS) ||
          (exactAddress && isFoodOrCafe)),
    )
    .sort((left, right) => {
      if (left.exactName !== right.exactName) {
        return left.exactName ? -1 : 1;
      }
      return left.distance - right.distance;
    })[0]?.document;
}

async function searchKakaoPlace(
  restaurant,
  apiKey,
  retries = 3,
  requestTimeoutMilliseconds = 10_000,
) {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set("query", restaurant.name);
  url.searchParams.set("x", String(restaurant.longitude));
  url.searchParams.set("y", String(restaurant.latitude));
  url.searchParams.set("radius", "2000");
  url.searchParams.set("size", "15");
  url.searchParams.set("sort", "distance");

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch (error) {
      if (attempt === retries) {
        throw new Error(
          `카카오 장소 검색 응답 시간이 초과됐습니다. (${restaurant.name})`,
          { cause: error },
        );
      }
      await wait(500 * 2 ** attempt);
      continue;
    }

    if (response.ok) {
      const body = await response.json();
      return selectKakaoPlace(body.documents ?? [], restaurant);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `카카오 API 인증에 실패했습니다. (${response.status}) REST API 키를 확인해 주세요.`,
      );
    }

    const canRetry = response.status === 429 || response.status >= 500;
    if (attempt === retries || !canRetry) {
      throw new Error(`카카오 장소 검색에 실패했습니다. (${response.status})`);
    }

    await wait(500 * 2 ** attempt);
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return fallback;
    }
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
      if (!isTemporaryWindowsLock || attempt === 9) {
        throw error;
      }
      await wait(100 * (attempt + 1));
    }
  }
}

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  return (
    process.argv
      .find((argument) => argument.startsWith(prefix))
      ?.slice(prefix.length) ?? fallback
  );
}

async function main() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error(
      "KAKAO_REST_API_KEY가 없습니다. .env.local에 REST API 키를 설정해 주세요.",
    );
  }

  const dataPath = resolve(readArgument("data", DEFAULT_DATA_PATH));
  const progressPath = resolve(readArgument("progress", DEFAULT_PROGRESS_PATH));
  const limitText = readArgument("limit", "Infinity");
  const limit = limitText === "Infinity" ? Infinity : Number(limitText);
  const delayMilliseconds = Number(readArgument("delay", "100"));
  const concurrency = Number(readArgument("concurrency", "1"));
  const requestTimeoutMilliseconds = Number(
    readArgument("request-timeout", "10000"),
  );
  const restaurants = await readJson(dataPath, []);
  const progress = await readJson(progressPath, { processedIds: [] });
  const processedIds = new Set(progress.processedIds ?? []);
  let processedThisRun = 0;
  let matchedThisRun = 0;

  if (!Array.isArray(restaurants)) {
    throw new Error("식당 데이터는 배열이어야 합니다.");
  }
  if (!Number.isFinite(limit) && limit !== Infinity) {
    throw new Error("--limit 값이 올바르지 않습니다.");
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("--concurrency는 1~10 사이의 정수여야 합니다.");
  }

  const saveCheckpoint = async () => {
    await writeJsonAtomic(dataPath, restaurants);
    await writeJsonAtomic(progressPath, {
      processedIds: [...processedIds],
      updatedAt: new Date().toISOString(),
    });
  };

  const pendingIndexes = restaurants
    .map((restaurant, index) => ({ restaurant, index }))
    .filter(
      ({ restaurant }) =>
        !processedIds.has(restaurant.id) && !restaurant.kakaoPlaceId,
    )
    .slice(0, limit === Infinity ? undefined : limit)
    .map(({ index }) => index);
  let lastCheckpointCount = 0;

  for (let offset = 0; offset < pendingIndexes.length; offset += concurrency) {
    const batchIndexes = pendingIndexes.slice(offset, offset + concurrency);
    const places = await Promise.all(
      batchIndexes.map((index) =>
        searchKakaoPlace(
          restaurants[index],
          apiKey,
          3,
          requestTimeoutMilliseconds,
        ),
      ),
    );

    for (let batchIndex = 0; batchIndex < batchIndexes.length; batchIndex += 1) {
      const index = batchIndexes[batchIndex];
      const restaurant = restaurants[index];
      const place = places[batchIndex];

      if (place) {
        restaurants[index] = {
          ...restaurant,
          kakaoPlaceId: place.id,
          kakaoPlaceUrl:
            place.place_url?.replace(/^http:/, "https:") ||
            `https://map.kakao.com/link/map/${place.id}`,
        };
        matchedThisRun += 1;
      }

      processedIds.add(restaurant.id);
      processedThisRun += 1;
    }

    if (processedThisRun - lastCheckpointCount >= CHECKPOINT_INTERVAL) {
      await saveCheckpoint();
      lastCheckpointCount = processedThisRun;
      console.log(
        `진행 ${processedIds.size.toLocaleString("ko-KR")}/${restaurants.length.toLocaleString("ko-KR")} · 이번 실행 매칭 ${matchedThisRun.toLocaleString("ko-KR")}건`,
      );
    }

    if (
      delayMilliseconds > 0 &&
      offset + concurrency < pendingIndexes.length
    ) {
      await wait(delayMilliseconds);
    }
  }

  await saveCheckpoint();
  console.log(
    `완료: 이번 실행 ${processedThisRun.toLocaleString("ko-KR")}건 처리, ${matchedThisRun.toLocaleString("ko-KR")}건 매칭`,
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
