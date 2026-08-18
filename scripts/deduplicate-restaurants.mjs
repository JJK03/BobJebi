const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_NEARBY_DISTANCE_METERS = 50;
const MIN_NORMALIZED_NAME_LENGTH = 2;

export const DEDUPLICATION_REASONS = {
  CONFIRMED_KAKAO_PLACE_ID: "confirmed-kakao-place-id",
  NAME_ADDRESS: "name-address",
  NAME_NEARBY_COORDINATES: "name-nearby-coordinates",
};

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

export function normalizeRestaurantName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사/g, "")
    .replace(/[^0-9a-z가-힣]/g, "");
}

export function normalizeRestaurantAddress(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function calculateRestaurantDistanceMeters(left, right) {
  const leftLatitude = Number(left?.latitude);
  const leftLongitude = Number(left?.longitude);
  const rightLatitude = Number(right?.latitude);
  const rightLongitude = Number(right?.longitude);
  if (
    !Number.isFinite(leftLatitude) ||
    !Number.isFinite(leftLongitude) ||
    !Number.isFinite(rightLatitude) ||
    !Number.isFinite(rightLongitude)
  ) {
    return Infinity;
  }

  const latitudeDelta = toRadians(rightLatitude - leftLatitude);
  const longitudeDelta = toRadians(rightLongitude - leftLongitude);
  const latitude1 = toRadians(leftLatitude);
  const latitude2 = toRadians(rightLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function isStrictlyKakaoConfirmed(restaurant) {
  return Boolean(
    restaurant?.kakaoPlaceId &&
      restaurant?.placeVerification?.provider === "kakao" &&
      restaurant?.placeVerification?.status === "confirmed",
  );
}

function hasConflictingConfirmedKakaoPlaces(left, right) {
  return (
    isStrictlyKakaoConfirmed(left) &&
    isStrictlyKakaoConfirmed(right) &&
    String(left.kakaoPlaceId) !== String(right.kakaoPlaceId)
  );
}

function groupIndexesByKey(restaurants, keySelector) {
  const groups = new Map();
  for (const [index, restaurant] of restaurants.entries()) {
    const key = keySelector(restaurant);
    if (!key) continue;
    const indexes = groups.get(key) ?? [];
    indexes.push(index);
    groups.set(key, indexes);
  }
  return groups;
}

function createUnionFind(restaurants) {
  const parents = Array.from(
    { length: restaurants.length },
    (_, index) => index,
  );
  const ranks = Array.from({ length: restaurants.length }, () => 0);
  const confirmedKakaoPlaceIds = restaurants.map((restaurant) =>
    isStrictlyKakaoConfirmed(restaurant)
      ? new Set([String(restaurant.kakaoPlaceId)])
      : new Set(),
  );

  const find = (index) => {
    if (parents[index] !== index) {
      parents[index] = find(parents[index]);
    }
    return parents[index];
  };

  const union = (leftIndex, rightIndex) => {
    const leftRoot = find(leftIndex);
    const rightRoot = find(rightIndex);
    if (leftRoot === rightRoot) return true;

    const combinedConfirmedIds = new Set([
      ...confirmedKakaoPlaceIds[leftRoot],
      ...confirmedKakaoPlaceIds[rightRoot],
    ]);
    if (combinedConfirmedIds.size > 1) {
      return false;
    }

    if (ranks[leftRoot] < ranks[rightRoot]) {
      parents[leftRoot] = rightRoot;
      confirmedKakaoPlaceIds[rightRoot] = combinedConfirmedIds;
    } else if (ranks[leftRoot] > ranks[rightRoot]) {
      parents[rightRoot] = leftRoot;
      confirmedKakaoPlaceIds[leftRoot] = combinedConfirmedIds;
    } else {
      parents[rightRoot] = leftRoot;
      ranks[leftRoot] += 1;
      confirmedKakaoPlaceIds[leftRoot] = combinedConfirmedIds;
    }
    return true;
  };

  return { find, union };
}

function getRestaurantCompletenessScore(restaurant) {
  return (
    (isStrictlyKakaoConfirmed(restaurant) ? 10_000 : 0) +
    (restaurant.kakaoPlaceId ? 1_000 : 0) +
    (restaurant.kakaoPlaceUrl ? 300 : 0) +
    (restaurant.phone ? 100 : 0) +
    Math.min(Array.isArray(restaurant.menus) ? restaurant.menus.length : 0, 50)
  );
}

function selectCanonicalIndex(restaurants, indexes) {
  return [...indexes].sort((leftIndex, rightIndex) => {
    const scoreDifference =
      getRestaurantCompletenessScore(restaurants[rightIndex]) -
      getRestaurantCompletenessScore(restaurants[leftIndex]);
    if (scoreDifference !== 0) return scoreDifference;

    return String(restaurants[leftIndex].id).localeCompare(
      String(restaurants[rightIndex].id),
    );
  })[0];
}

function mergeMenus(restaurants, canonicalIndex, indexes) {
  const orderedIndexes = [
    canonicalIndex,
    ...indexes.filter((index) => index !== canonicalIndex),
  ];
  const menusByKey = new Map();

  for (const index of orderedIndexes) {
    for (const menu of restaurants[index].menus ?? []) {
      const name = normalizeText(menu?.name);
      const price = Number(menu?.price);
      if (!name || !Number.isFinite(price)) continue;
      const key = `${normalizeRestaurantName(name)}|${price}`;
      if (!menusByKey.has(key)) {
        menusByKey.set(key, { name, price });
      }
    }
  }

  return [...menusByKey.values()].sort(
    (left, right) =>
      left.price - right.price || left.name.localeCompare(right.name, "ko"),
  );
}

function mergeRestaurantGroup(restaurants, indexes, canonicalIndex) {
  const canonical = restaurants[canonicalIndex];
  const ordered = [
    canonical,
    ...indexes
      .filter((index) => index !== canonicalIndex)
      .map((index) => restaurants[index]),
  ];
  const placeSource =
    ordered.find(isStrictlyKakaoConfirmed) ??
    ordered.find((restaurant) => restaurant.kakaoPlaceId);
  const verificationSource =
    ordered.find(isStrictlyKakaoConfirmed) ??
    ordered.find((restaurant) => restaurant.placeVerification);
  const phone = ordered.find((restaurant) => restaurant.phone)?.phone;

  const merged = {
    ...canonical,
    ...(phone ? { phone } : {}),
    menus: mergeMenus(restaurants, canonicalIndex, indexes),
  };

  if (placeSource?.kakaoPlaceId) {
    merged.kakaoPlaceId = placeSource.kakaoPlaceId;
  }
  if (placeSource?.kakaoPlaceUrl) {
    merged.kakaoPlaceUrl = placeSource.kakaoPlaceUrl;
  }
  if (verificationSource?.placeVerification) {
    merged.placeVerification = verificationSource.placeVerification;
  }

  return merged;
}

function analyzeDuplicateIndexes(restaurants, nearbyDistanceMeters) {
  const { find, union } = createUnionFind(restaurants);
  const edges = [];
  const connect = (leftIndex, rightIndex, reason) => {
    if (union(leftIndex, rightIndex)) {
      edges.push({ leftIndex, rightIndex, reason });
    }
  };

  const confirmedKakaoGroups = groupIndexesByKey(restaurants, (restaurant) =>
    isStrictlyKakaoConfirmed(restaurant)
      ? String(restaurant.kakaoPlaceId)
      : "",
  );
  for (const indexes of confirmedKakaoGroups.values()) {
    for (let index = 1; index < indexes.length; index += 1) {
      connect(
        indexes[0],
        indexes[index],
        DEDUPLICATION_REASONS.CONFIRMED_KAKAO_PLACE_ID,
      );
    }
  }

  const nameAddressGroups = groupIndexesByKey(restaurants, (restaurant) => {
    const name = normalizeRestaurantName(restaurant.name);
    const address = normalizeRestaurantAddress(restaurant.address);
    return name && address ? `${name}|${address}` : "";
  });
  for (const indexes of nameAddressGroups.values()) {
    for (let index = 1; index < indexes.length; index += 1) {
      if (
        hasConflictingConfirmedKakaoPlaces(
          restaurants[indexes[0]],
          restaurants[indexes[index]],
        )
      ) {
        continue;
      }
      connect(
        indexes[0],
        indexes[index],
        DEDUPLICATION_REASONS.NAME_ADDRESS,
      );
    }
  }

  const nameGroups = groupIndexesByKey(restaurants, (restaurant) => {
    const name = normalizeRestaurantName(restaurant.name);
    return name.length >= MIN_NORMALIZED_NAME_LENGTH ? name : "";
  });
  for (const indexes of nameGroups.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const leftIndex = indexes[left];
        const rightIndex = indexes[right];
        if (
          hasConflictingConfirmedKakaoPlaces(
            restaurants[leftIndex],
            restaurants[rightIndex],
          )
        ) {
          continue;
        }
        if (
          calculateRestaurantDistanceMeters(
            restaurants[leftIndex],
            restaurants[rightIndex],
          ) <= nearbyDistanceMeters
        ) {
          connect(
            leftIndex,
            rightIndex,
            DEDUPLICATION_REASONS.NAME_NEARBY_COORDINATES,
          );
        }
      }
    }
  }

  const indexesByRoot = new Map();
  for (let index = 0; index < restaurants.length; index += 1) {
    const root = find(index);
    const indexes = indexesByRoot.get(root) ?? [];
    indexes.push(index);
    indexesByRoot.set(root, indexes);
  }

  return [...indexesByRoot.values()]
    .filter((indexes) => indexes.length > 1)
    .map((indexes) => {
      const canonicalIndex = selectCanonicalIndex(restaurants, indexes);
      const indexSet = new Set(indexes);
      const reasons = [
        ...new Set(
          edges
            .filter(
              ({ leftIndex, rightIndex }) =>
                indexSet.has(leftIndex) && indexSet.has(rightIndex),
            )
            .map(({ reason }) => reason),
        ),
      ].sort();

      return {
        indexes,
        canonicalIndex,
        reasons,
        firstIndex: Math.min(...indexes),
      };
    })
    .sort((left, right) => left.firstIndex - right.firstIndex);
}

function toGroupDetail(restaurants, group) {
  const canonical = restaurants[group.canonicalIndex];
  return {
    canonicalId: String(canonical.id),
    mergedIds: group.indexes
      .filter((index) => index !== group.canonicalIndex)
      .map((index) => String(restaurants[index].id)),
    recordCount: group.indexes.length,
    reasons: group.reasons,
    restaurants: group.indexes.map((index) => ({
      id: String(restaurants[index].id),
      name: String(restaurants[index].name ?? ""),
      address: String(restaurants[index].address ?? ""),
      ...(restaurants[index].kakaoPlaceId
        ? { kakaoPlaceId: String(restaurants[index].kakaoPlaceId) }
        : {}),
    })),
  };
}

export function findRestaurantDuplicateGroups(restaurants, options = {}) {
  if (!Array.isArray(restaurants)) {
    throw new Error("식당 데이터는 배열이어야 합니다.");
  }
  const nearbyDistanceMeters =
    options.nearbyDistanceMeters ?? DEFAULT_NEARBY_DISTANCE_METERS;
  if (!Number.isFinite(nearbyDistanceMeters) || nearbyDistanceMeters < 0) {
    throw new Error("nearbyDistanceMeters는 0 이상의 숫자여야 합니다.");
  }

  return analyzeDuplicateIndexes(restaurants, nearbyDistanceMeters).map(
    (group) => toGroupDetail(restaurants, group),
  );
}

export function deduplicateRestaurants(restaurants, options = {}) {
  if (!Array.isArray(restaurants)) {
    throw new Error("식당 데이터는 배열이어야 합니다.");
  }
  const nearbyDistanceMeters =
    options.nearbyDistanceMeters ?? DEFAULT_NEARBY_DISTANCE_METERS;
  if (!Number.isFinite(nearbyDistanceMeters) || nearbyDistanceMeters < 0) {
    throw new Error("nearbyDistanceMeters는 0 이상의 숫자여야 합니다.");
  }

  const duplicateGroups = analyzeDuplicateIndexes(
    restaurants,
    nearbyDistanceMeters,
  );
  const groupByIndex = new Map();
  for (const group of duplicateGroups) {
    for (const index of group.indexes) {
      groupByIndex.set(index, group);
    }
  }

  const deduplicated = [];
  for (let index = 0; index < restaurants.length; index += 1) {
    const group = groupByIndex.get(index);
    if (!group) {
      deduplicated.push(restaurants[index]);
      continue;
    }
    if (index !== group.firstIndex) continue;

    deduplicated.push(
      mergeRestaurantGroup(restaurants, group.indexes, group.canonicalIndex),
    );
  }

  return {
    restaurants: deduplicated,
    removedCount: restaurants.length - deduplicated.length,
    groups: duplicateGroups.map((group) =>
      toGroupDetail(restaurants, group),
    ),
  };
}
