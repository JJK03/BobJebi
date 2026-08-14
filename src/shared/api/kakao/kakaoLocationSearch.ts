import type { Coordinates } from '../../lib/geo'
import {
  isKakaoMapsConfigured,
  loadKakaoMaps,
  type KakaoMapsNamespace,
} from './kakaoMapsSdk'

export interface LocationSearchResult {
  id: string
  name: string
  address: string
  coordinates: Coordinates
}

export const isLocationSearchConfigured = isKakaoMapsConfigured

const toCoordinates = (x: string, y: string): Coordinates => ({
  latitude: Number(y),
  longitude: Number(x),
})

const getCoordinateKey = (result: LocationSearchResult): string =>
  `${result.coordinates.latitude.toFixed(5)}-${result.coordinates.longitude.toFixed(5)}`

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

function mergeLocationSearchResults(
  placeResults: LocationSearchResult[],
  addressResults: LocationSearchResult[],
): LocationSearchResult[] {
  const placeIds = new Set<string>()
  const uniquePlaces = placeResults.filter((result) => {
    if (placeIds.has(result.id)) {
      return false
    }
    placeIds.add(result.id)
    return true
  })
  const usedCoordinates = new Set(uniquePlaces.map(getCoordinateKey))
  const uniqueAddresses = addressResults.filter((result) => {
    const coordinateKey = getCoordinateKey(result)
    if (usedCoordinates.has(coordinateKey)) {
      return false
    }
    usedCoordinates.add(coordinateKey)
    return true
  })

  return [...uniquePlaces, ...uniqueAddresses].slice(0, 5)
}

export async function searchLocations(
  query: string,
): Promise<LocationSearchResult[]> {
  const maps = await loadKakaoMaps()
  const [placeSearch, addressSearch] = await Promise.allSettled([
    searchPlaces(maps, query),
    searchAddresses(maps, query),
  ])

  if (placeSearch.status === 'rejected' && addressSearch.status === 'rejected') {
    throw new Error('위치 검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const placeResults =
    placeSearch.status === 'fulfilled' ? placeSearch.value : []
  const addressResults =
    addressSearch.status === 'fulfilled' ? addressSearch.value : []

  return mergeLocationSearchResults(placeResults, addressResults)
}
