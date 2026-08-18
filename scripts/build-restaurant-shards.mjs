import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const CELL_SIZE_DEGREES = 0.25;
const LATITUDE_OFFSET = 0.2;
const LONGITUDE_OFFSET = 0.2;
const SHARD_ROOT = resolve("public/data/shards");

const DATASETS = {
  "good-price": {
    inputPath: resolve("public/data/restaurants.json"),
    outputDirectory: resolve(SHARD_ROOT, "good-price"),
    publicPath: "/data/shards/good-price",
  },
  "incheon-smart-food": {
    inputPath: resolve("public/data/incheon-restaurants.json"),
    outputDirectory: resolve(SHARD_ROOT, "incheon-smart-food"),
    publicPath: "/data/shards/incheon-smart-food",
  },
};

function readArgument(name) {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function assertSafeOutputDirectory(outputDirectory) {
  const relativePath = relative(SHARD_ROOT, outputDirectory);
  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    resolve(SHARD_ROOT, relativePath) !== outputDirectory
  ) {
    throw new Error(`안전하지 않은 조각 출력 경로입니다: ${outputDirectory}`);
  }
}

function isValidRestaurantLocation(restaurant) {
  return (
    restaurant &&
    typeof restaurant === "object" &&
    Number.isFinite(restaurant.latitude) &&
    Number.isFinite(restaurant.longitude)
  );
}

export function createTileKey(latitude, longitude) {
  const latitudeIndex = Math.floor(
    (latitude - LATITUDE_OFFSET) / CELL_SIZE_DEGREES,
  );
  const longitudeIndex = Math.floor(
    (longitude - LONGITUDE_OFFSET) / CELL_SIZE_DEGREES,
  );
  return `${latitudeIndex}_${longitudeIndex}`;
}

export async function buildRestaurantShards(source) {
  const config = DATASETS[source];
  if (!config) {
    throw new Error(`지원하지 않는 식당 데이터 소스입니다: ${source}`);
  }

  assertSafeOutputDirectory(config.outputDirectory);
  const restaurants = JSON.parse(await readFile(config.inputPath, "utf8"));
  if (!Array.isArray(restaurants) || !restaurants.every(isValidRestaurantLocation)) {
    throw new Error(`${source} 식당 데이터의 좌표 형식이 올바르지 않습니다.`);
  }

  const tiles = new Map();
  for (const restaurant of restaurants) {
    const key = createTileKey(restaurant.latitude, restaurant.longitude);
    const entries = tiles.get(key) ?? [];
    entries.push(restaurant);
    tiles.set(key, entries);
  }

  const temporaryDirectory = resolve(
    dirname(config.outputDirectory),
    `.${source}.tmp-${process.pid}-${Date.now()}`,
  );
  assertSafeOutputDirectory(temporaryDirectory);
  await mkdir(temporaryDirectory, { recursive: true });

  try {
    const manifestTiles = {};
    const sortedTiles = [...tiles.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );

    await Promise.all(
      sortedTiles.map(async ([key, entries]) => {
        const filename = `${key}.json`;
        manifestTiles[key] = {
          path: `${config.publicPath}/${filename}`,
          count: entries.length,
        };
        await writeFile(
          resolve(temporaryDirectory, filename),
          `${JSON.stringify(entries)}\n`,
          "utf8",
        );
      }),
    );

    const manifest = {
      version: 1,
      source,
      totalCount: restaurants.length,
      cellSizeDegrees: CELL_SIZE_DEGREES,
      latitudeOffset: LATITUDE_OFFSET,
      longitudeOffset: LONGITUDE_OFFSET,
      tiles: manifestTiles,
    };
    await writeFile(
      resolve(temporaryDirectory, "manifest.json"),
      `${JSON.stringify(manifest)}\n`,
      "utf8",
    );

    await rm(config.outputDirectory, { recursive: true, force: true });
    await rename(temporaryDirectory, config.outputDirectory);
    console.log(
      `${source}: 식당 ${restaurants.length.toLocaleString("ko-KR")}곳을 ${tiles.size.toLocaleString("ko-KR")}개 위치 조각으로 생성했습니다.`,
    );
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const selectedSource = readArgument("source");
  const sources = selectedSource ? [selectedSource] : Object.keys(DATASETS);
  for (const source of sources) {
    await buildRestaurantShards(source);
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
