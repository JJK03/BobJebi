import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadKakaoMaps,
  type KakaoAddressResult,
  type KakaoMapsNamespace,
  type KakaoPlaceResult,
  type KakaoSearchStatus,
} from './kakaoMapsSdk'
import { searchLocations } from './kakaoLocationSearch'

vi.mock('./kakaoMapsSdk', () => ({
  isKakaoMapsConfigured: true,
  loadKakaoMaps: vi.fn(),
}))

interface KakaoMapsFixture {
  placeResults?: KakaoPlaceResult[]
  placeStatus?: KakaoSearchStatus
  addressResults?: KakaoAddressResult[]
  addressStatus?: KakaoSearchStatus
}

function createKakaoMapsFixture({
  placeResults = [],
  placeStatus = 'OK',
  addressResults = [],
  addressStatus = 'OK',
}: KakaoMapsFixture): KakaoMapsNamespace {
  return {
    load: (callback) => callback(),
    services: {
      Places: class {
        keywordSearch(
          _query: string,
          callback: (
            results: KakaoPlaceResult[],
            status: KakaoSearchStatus,
          ) => void,
        ) {
          callback(placeResults, placeStatus)
        }
      },
      Geocoder: class {
        addressSearch(
          _query: string,
          callback: (
            results: KakaoAddressResult[],
            status: KakaoSearchStatus,
          ) => void,
        ) {
          callback(addressResults, addressStatus)
        }
      },
      Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT' },
    },
  }
}

describe('searchLocations', () => {
  beforeEach(() => {
    vi.mocked(loadKakaoMaps).mockReset()
  })

  it('같은 좌표의 주소보다 장소명을 우선하고 서로 다른 장소는 유지한다', async () => {
    vi.mocked(loadKakaoMaps).mockResolvedValue(
      createKakaoMapsFixture({
        placeResults: [
          {
            id: 'place-a',
            place_name: '송도식당',
            address_name: '인천 연수구 송도동 1',
            road_address_name: '인천 연수구 센트럴로 1',
            x: '126.6400',
            y: '37.3900',
          },
          {
            id: 'place-b',
            place_name: '송도분식',
            address_name: '인천 연수구 송도동 1',
            road_address_name: '인천 연수구 센트럴로 1',
            x: '126.6400',
            y: '37.3900',
          },
        ],
        addressResults: [
          {
            address_name: '인천 연수구 송도동 1',
            address_type: 'REGION_ADDR',
            x: '126.6400',
            y: '37.3900',
          },
        ],
      }),
    )

    const results = await searchLocations('송도')

    expect(results.map(({ name }) => name)).toEqual(['송도식당', '송도분식'])
  })

  it('장소 검색이 실패해도 주소 검색 결과를 반환한다', async () => {
    vi.mocked(loadKakaoMaps).mockResolvedValue(
      createKakaoMapsFixture({
        placeStatus: 'ERROR',
        addressResults: [
          {
            address_name: '인천 연수구 송도동',
            address_type: 'REGION',
            x: '126.6400',
            y: '37.3900',
          },
        ],
      }),
    )

    await expect(searchLocations('송도동')).resolves.toMatchObject([
      { name: '인천 연수구 송도동' },
    ])
  })

  it('장소와 주소 검색이 모두 실패하면 오류를 반환한다', async () => {
    vi.mocked(loadKakaoMaps).mockResolvedValue(
      createKakaoMapsFixture({
        placeStatus: 'ERROR',
        addressStatus: 'ERROR',
      }),
    )

    await expect(searchLocations('송도')).rejects.toThrow(
      '위치 검색 중 문제가 발생했습니다.',
    )
  })
})
