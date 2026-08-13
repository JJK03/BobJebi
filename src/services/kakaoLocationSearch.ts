import type { Coordinates } from '../domain/restaurant'

const KAKAO_MAP_SCRIPT_ID = 'kakao-map-services-sdk'
const KAKAO_JAVASCRIPT_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim()

interface KakaoPlaceResult {
  id: string
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
}

interface KakaoAddressResult {
  address_name: string
  address_type: string
  x: string
  y: string
}

type KakaoSearchStatus = string

interface KakaoPlacesService {
  keywordSearch: (
    query: string,
    callback: (
      results: KakaoPlaceResult[],
      status: KakaoSearchStatus,
    ) => void,
    options?: { size?: number },
  ) => void
}

interface KakaoGeocoderService {
  addressSearch: (
    query: string,
    callback: (
      results: KakaoAddressResult[],
      status: KakaoSearchStatus,
    ) => void,
    options?: { size?: number; analyze_type?: 'SIMILAR' | 'EXACT' },
  ) => void
}

interface KakaoMapsNamespace {
  load: (callback: () => void) => void
  services: {
    Places: new () => KakaoPlacesService
    Geocoder: new () => KakaoGeocoderService
    Status: {
      OK: KakaoSearchStatus
      ZERO_RESULT: KakaoSearchStatus
    }
  }
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsNamespace }
  }
}

export interface LocationSearchResult {
  id: string
  name: string
  address: string
  coordinates: Coordinates
}

let kakaoMapsPromise: Promise<KakaoMapsNamespace> | undefined

export const isLocationSearchConfigured = Boolean(KAKAO_JAVASCRIPT_KEY)

function loadKakaoMaps() {
  if (!KAKAO_JAVASCRIPT_KEY) {
    return Promise.reject(
      new Error('카카오 JavaScript 키가 설정되지 않았습니다.'),
    )
  }

  if (window.kakao?.maps?.services) {
    return Promise.resolve(window.kakao.maps)
  }

  if (kakaoMapsPromise) {
    return kakaoMapsPromise
  }

  kakaoMapsPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    const finishLoading = () => {
      if (!window.kakao?.maps) {
        reject(new Error('카카오 지도 서비스를 불러오지 못했습니다.'))
        return
      }

      window.kakao.maps.load(() => {
        if (window.kakao?.maps?.services) {
          resolve(window.kakao.maps)
        } else {
          reject(new Error('카카오 장소 검색 서비스를 사용할 수 없습니다.'))
        }
      })
    }

    const existingScript = document.getElementById(
      KAKAO_MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener('load', finishLoading, { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('카카오 지도 서비스를 불러오지 못했습니다.')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.id = KAKAO_MAP_SCRIPT_ID
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JAVASCRIPT_KEY)}&libraries=services&autoload=false`
    script.addEventListener('load', finishLoading, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('카카오 지도 서비스를 불러오지 못했습니다.')),
      { once: true },
    )
    document.head.append(script)
  }).catch((error) => {
    kakaoMapsPromise = undefined
    throw error
  })

  return kakaoMapsPromise
}

const toCoordinates = (x: string, y: string): Coordinates => ({
  latitude: Number(y),
  longitude: Number(x),
})

const searchAddresses = (
  maps: KakaoMapsNamespace,
  query: string,
): Promise<LocationSearchResult[]> =>
  new Promise((resolve, reject) => {
    const geocoder = new maps.services.Geocoder()
    geocoder.addressSearch(
      query,
      (results, status) => {
        if (status === maps.services.Status.OK) {
          resolve(
            results.slice(0, 3).map((result) => ({
              id: `address-${result.x}-${result.y}`,
              name: result.address_name,
              address: result.address_name,
              coordinates: toCoordinates(result.x, result.y),
            })),
          )
        } else if (status === maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else {
          reject(new Error('주소 검색 중 문제가 발생했습니다.'))
        }
      },
      { size: 3, analyze_type: 'SIMILAR' },
    )
  })

const searchPlaces = (
  maps: KakaoMapsNamespace,
  query: string,
): Promise<LocationSearchResult[]> =>
  new Promise((resolve, reject) => {
    const places = new maps.services.Places()
    places.keywordSearch(
      query,
      (results, status) => {
        if (status === maps.services.Status.OK) {
          resolve(
            results.slice(0, 5).map((result) => ({
              id: `place-${result.id}`,
              name: result.place_name,
              address: result.road_address_name || result.address_name,
              coordinates: toCoordinates(result.x, result.y),
            })),
          )
        } else if (status === maps.services.Status.ZERO_RESULT) {
          resolve([])
        } else {
          reject(new Error('장소 검색 중 문제가 발생했습니다.'))
        }
      },
      { size: 5 },
    )
  })

export async function searchLocations(query: string) {
  const maps = await loadKakaoMaps()
  const settledResults = await Promise.allSettled([
    searchAddresses(maps, query),
    searchPlaces(maps, query),
  ])
  const successfulResults = settledResults.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  )

  if (successfulResults.length === 0 && settledResults.every((result) => result.status === 'rejected')) {
    throw new Error('위치 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const seen = new Set<string>()
  return successfulResults
    .filter((result) => {
      const coordinateKey = `${result.coordinates.latitude.toFixed(5)}-${result.coordinates.longitude.toFixed(5)}`
      if (seen.has(coordinateKey)) {
        return false
      }
      seen.add(coordinateKey)
      return true
    })
    .slice(0, 5)
}
