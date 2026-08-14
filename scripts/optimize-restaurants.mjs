import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] ?? "public/data/restaurants.json");
const beforeBytes = (await stat(inputPath)).size;
const restaurants = JSON.parse(await readFile(inputPath, "utf8"));

if (!Array.isArray(restaurants)) {
  throw new Error("식당 데이터는 배열이어야 합니다.");
}

let removedGeocodingCount = 0;
const optimizedRestaurants = restaurants.map((restaurant) => {
  const normalizedRestaurant =
    typeof restaurant === "object" &&
    restaurant !== null &&
    typeof restaurant.kakaoPlaceUrl === "string"
      ? {
          ...restaurant,
          kakaoPlaceUrl: restaurant.kakaoPlaceUrl.replace(/^http:/, "https:"),
        }
      : restaurant;

  if (
    typeof normalizedRestaurant !== "object" ||
    normalizedRestaurant === null ||
    !("geocoding" in normalizedRestaurant)
  ) {
    return normalizedRestaurant;
  }

  const { geocoding: _geocoding, ...appRestaurant } = normalizedRestaurant;
  removedGeocodingCount += 1;
  return appRestaurant;
});

await writeFile(inputPath, `${JSON.stringify(optimizedRestaurants)}\n`, "utf8");

const afterBytes = (await stat(inputPath)).size;
const savedPercent = (((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(
  1,
);

console.log(
  `식당 ${optimizedRestaurants.length.toLocaleString("ko-KR")}건 최적화 완료`,
);
console.log(
  `geocoding 제거: ${removedGeocodingCount.toLocaleString("ko-KR")}건`,
);
console.log(
  `파일 크기: ${beforeBytes.toLocaleString("ko-KR")} → ${afterBytes.toLocaleString("ko-KR")} bytes (${savedPercent}% 감소)`,
);
