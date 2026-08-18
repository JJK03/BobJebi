import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Restaurant } from '../model/restaurant'
import {
  clearRestaurantDataCache,
  getRequiredRestaurantTileKeys,
  loadNearbyRestaurants,
  loadRestaurantManifest,
  type RestaurantManifest,
} from './loadRestaurants'

const restaurant: Restaurant = {
  id: 'songdo-meal',
  name: '송도식당',
  category: '한식',
  province: '인천광역시',
  district: '연수구',
  address: '인천 연수구 센트럴로 1',
  latitude: 37.39,
  longitude: 126.64,
  menus: [{ name: '백반', price: 9_000 }],
}

const manifest: RestaurantManifest = {
  version: 1,
  source: 'good-price',
  totalCount: 9_377,
  cellSizeDegrees: 0.25,
  latitudeOffset: 0.2,
  longitudeOffset: 0.2,
  tiles: {
    '148_505': {
      path: '/data/shards/good-price/148_505.json',
      count: 1,
    },
    '148_506': {
      path: '/data/shards/good-price/148_506.json',
      count: 1,
    },
    '149_505': {
      path: '/data/shards/good-price/149_505.json',
      count: 1,
    },
  },
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  clearRestaurantDataCache()
  vi.unstubAllGlobals()
})

describe('위치 기반 식당 데이터 로딩', () => {
  it('작은 인덱스 파일에서 전체 등록 식당 수를 읽는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(manifest))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadRestaurantManifest('good-price')

    expect(result.totalCount).toBe(9_377)
    expect(fetchMock).toHaveBeenCalledWith(
      '/data/shards/good-price/manifest.json',
      { signal: undefined },
    )
  })

  it('검색 반경과 겹치는 위치 조각만 고른다', () => {
    const keys = getRequiredRestaurantTileKeys(
      manifest,
      { latitude: 37.39, longitude: 126.64 },
      20_000,
    )

    expect(keys).toContain('148_505')
    expect(keys.length).toBeLessThanOrEqual(9)
  })

  it('선택된 조각만 내려받고 식당 배열로 합친다', async () => {
    const selectedManifest: RestaurantManifest = {
      ...manifest,
      tiles: {
        '148_505': manifest.tiles['148_505'],
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([restaurant]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await loadNearbyRestaurants(
      selectedManifest,
      { latitude: 37.39, longitude: 126.64 },
      2_000,
    )

    expect(result).toEqual([restaurant])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/data/shards/good-price/148_505.json',
      { signal: undefined },
    )
  })

  it('손상된 위치 조각은 사용자에게 오류로 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }]))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      loadNearbyRestaurants(
        manifest,
        { latitude: 37.39, longitude: 126.64 },
        2_000,
      ),
    ).rejects.toThrow('식당 위치 조각의 데이터 형식이 올바르지 않습니다.')
  })

  it('근거가 있는 카카오 확인 상태를 포함한 식당을 읽는다', async () => {
    const verifiedRestaurant: Restaurant = {
      ...restaurant,
      kakaoPlaceId: '123',
      placeVerification: {
        provider: 'kakao',
        status: 'confirmed',
        matchedBy: 'name-address',
        distanceMeters: 24,
        checkedAt: '2026-08-18T00:00:00.000Z',
      },
    }
    const selectedManifest: RestaurantManifest = {
      ...manifest,
      tiles: { '148_505': manifest.tiles['148_505'] },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([verifiedRestaurant])))

    await expect(
      loadNearbyRestaurants(
        selectedManifest,
        { latitude: 37.39, longitude: 126.64 },
        2_000,
      ),
    ).resolves.toEqual([verifiedRestaurant])
  })

  it('확인 근거가 빠진 카카오 확인 상태는 거부한다', async () => {
    const invalidRestaurant = {
      ...restaurant,
      kakaoPlaceId: '123',
      placeVerification: {
        provider: 'kakao',
        status: 'confirmed',
        checkedAt: '2026-08-18T00:00:00.000Z',
      },
    }
    const selectedManifest: RestaurantManifest = {
      ...manifest,
      tiles: { '148_505': manifest.tiles['148_505'] },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([invalidRestaurant])))

    await expect(
      loadNearbyRestaurants(
        selectedManifest,
        { latitude: 37.39, longitude: 126.64 },
        2_000,
      ),
    ).rejects.toThrow('식당 위치 조각의 데이터 형식이 올바르지 않습니다.')
  })
})
