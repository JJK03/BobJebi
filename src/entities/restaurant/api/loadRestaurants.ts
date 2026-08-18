import type { Coordinates } from '../../../shared/lib/geo'
import {
  RESTAURANT_CATEGORIES,
  type Restaurant,
  type RestaurantCategory,
} from '../model/restaurant'
import {
  RESTAURANT_SOURCES,
  type RestaurantSource,
} from '../model/restaurantSource'

const METERS_PER_LATITUDE_DEGREE = 111_320
const categorySet = new Set<string>(RESTAURANT_CATEGORIES)
const manifestCache = new Map<RestaurantSource, RestaurantManifest>()
const tileCache = new Map<string, Restaurant[]>()

interface RestaurantTile {
  path: string
  count: number
}

export interface RestaurantManifest {
  version: 1
  source: RestaurantSource
  totalCount: number
  cellSizeDegrees: number
  latitudeOffset: number
  longitudeOffset: number
  tiles: Record<string, RestaurantTile>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPlaceVerification(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  const isConfirmed = value.status === 'confirmed'
  const hasValidMatchEvidence =
    value.matchedBy === 'name-address' ||
    value.matchedBy === 'name-coordinates'

  return (
    value.provider === 'kakao' &&
    (isConfirmed || value.status === 'unverified') &&
    typeof value.checkedAt === 'string' &&
    (!isConfirmed || hasValidMatchEvidence) &&
    (value.matchedBy === undefined || hasValidMatchEvidence) &&
    (value.distanceMeters === undefined ||
      (typeof value.distanceMeters === 'number' &&
        Number.isFinite(value.distanceMeters) &&
        value.distanceMeters >= 0))
  )
}

function isRestaurant(value: unknown): value is Restaurant {
  if (!isRecord(value) || !Array.isArray(value.menus)) {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    categorySet.has(value.category as RestaurantCategory) &&
    typeof value.province === 'string' &&
    typeof value.district === 'string' &&
    typeof value.address === 'string' &&
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    (value.phone === undefined || typeof value.phone === 'string') &&
    (value.kakaoPlaceId === undefined ||
      typeof value.kakaoPlaceId === 'string') &&
    (value.kakaoPlaceUrl === undefined ||
      typeof value.kakaoPlaceUrl === 'string') &&
    (value.placeVerification === undefined ||
      isPlaceVerification(value.placeVerification)) &&
    value.menus.length > 0 &&
    value.menus.every(
      (menu) =>
        isRecord(menu) &&
        typeof menu.name === 'string' &&
        typeof menu.price === 'number',
    )
  )
}

function isRestaurantManifest(
  value: unknown,
  source: RestaurantSource,
): value is RestaurantManifest {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.source !== source ||
    !Number.isInteger(value.totalCount) ||
    !Number.isFinite(value.cellSizeDegrees) ||
    !Number.isFinite(value.latitudeOffset) ||
    !Number.isFinite(value.longitudeOffset) ||
    !isRecord(value.tiles)
  ) {
    return false
  }

  return Object.values(value.tiles).every(
    (tile) =>
      isRecord(tile) &&
      typeof tile.path === 'string' &&
      tile.path.startsWith('/data/shards/') &&
      Number.isInteger(tile.count) &&
      Number(tile.count) >= 0,
  )
}

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal })
  if (!response.ok) {
    throw new Error(`식당 데이터를 불러오지 못했습니다. (${response.status})`)
  }
  return response.json()
}

export async function loadRestaurantManifest(
  source: RestaurantSource,
  signal?: AbortSignal,
): Promise<RestaurantManifest> {
  const cached = manifestCache.get(source)
  if (cached) {
    return cached
  }

  const data = await fetchJson(RESTAURANT_SOURCES[source].manifestPath, signal)
  if (!isRestaurantManifest(data, source)) {
    throw new Error('식당 데이터 인덱스 형식이 올바르지 않습니다.')
  }

  manifestCache.set(source, data)
  return data
}

function getTileIndex(coordinate: number, offset: number, cellSize: number) {
  return Math.floor((coordinate - offset) / cellSize)
}

export function getRequiredRestaurantTileKeys(
  manifest: RestaurantManifest,
  position: Coordinates,
  maxDistanceMeters: number,
): string[] {
  if (
    !Number.isFinite(position.latitude) ||
    !Number.isFinite(position.longitude) ||
    !Number.isFinite(maxDistanceMeters) ||
    maxDistanceMeters < 0
  ) {
    return []
  }

  const latitudeDelta = maxDistanceMeters / METERS_PER_LATITUDE_DEGREE
  const longitudeScale = Math.max(
    Math.abs(Math.cos((position.latitude * Math.PI) / 180)),
    0.01,
  )
  const longitudeDelta = latitudeDelta / longitudeScale
  const minimumLatitudeIndex = getTileIndex(
    position.latitude - latitudeDelta,
    manifest.latitudeOffset,
    manifest.cellSizeDegrees,
  )
  const maximumLatitudeIndex = getTileIndex(
    position.latitude + latitudeDelta,
    manifest.latitudeOffset,
    manifest.cellSizeDegrees,
  )
  const minimumLongitudeIndex = getTileIndex(
    position.longitude - longitudeDelta,
    manifest.longitudeOffset,
    manifest.cellSizeDegrees,
  )
  const maximumLongitudeIndex = getTileIndex(
    position.longitude + longitudeDelta,
    manifest.longitudeOffset,
    manifest.cellSizeDegrees,
  )
  const keys: string[] = []

  for (
    let latitudeIndex = minimumLatitudeIndex;
    latitudeIndex <= maximumLatitudeIndex;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = minimumLongitudeIndex;
      longitudeIndex <= maximumLongitudeIndex;
      longitudeIndex += 1
    ) {
      const key = `${latitudeIndex}_${longitudeIndex}`
      if (manifest.tiles[key]) {
        keys.push(key)
      }
    }
  }

  return keys
}

async function loadRestaurantTile(
  tile: RestaurantTile,
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const cached = tileCache.get(tile.path)
  if (cached) {
    return cached
  }

  const data = await fetchJson(tile.path, signal)
  if (!Array.isArray(data) || !data.every(isRestaurant)) {
    throw new Error('식당 위치 조각의 데이터 형식이 올바르지 않습니다.')
  }

  tileCache.set(tile.path, data)
  return data
}

export async function loadNearbyRestaurants(
  manifest: RestaurantManifest,
  position: Coordinates,
  maxDistanceMeters: number,
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const keys = getRequiredRestaurantTileKeys(
    manifest,
    position,
    maxDistanceMeters,
  )
  const tiles = await Promise.all(
    keys.map((key) => loadRestaurantTile(manifest.tiles[key], signal)),
  )
  return tiles.flat()
}

export function clearRestaurantDataCache() {
  manifestCache.clear()
  tileCache.clear()
}
