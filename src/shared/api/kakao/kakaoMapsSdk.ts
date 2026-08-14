const KAKAO_MAP_SCRIPT_ID = 'kakao-map-services-sdk'
const KAKAO_MAP_SCRIPT_STATE = 'kakaoMapsState'
const KAKAO_MAP_LOAD_TIMEOUT_MS = 15_000
const KAKAO_JAVASCRIPT_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim()

export interface KakaoPlaceResult {
  id: string
  place_name: string
  address_name: string
  road_address_name: string
  x: string
  y: string
}

export interface KakaoAddressResult {
  address_name: string
  address_type: string
  x: string
  y: string
}

export type KakaoSearchStatus = string

export interface KakaoPlacesService {
  keywordSearch: (
    query: string,
    callback: (
      results: KakaoPlaceResult[],
      status: KakaoSearchStatus,
    ) => void,
    options?: { size?: number },
  ) => void
}

export interface KakaoGeocoderService {
  addressSearch: (
    query: string,
    callback: (
      results: KakaoAddressResult[],
      status: KakaoSearchStatus,
    ) => void,
    options?: { size?: number; analyze_type?: 'SIMILAR' | 'EXACT' },
  ) => void
}

export interface KakaoMapsNamespace {
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

let kakaoMapsPromise: Promise<KakaoMapsNamespace> | undefined

export const isKakaoMapsConfigured = Boolean(KAKAO_JAVASCRIPT_KEY)

function createKakaoMapsScript(): HTMLScriptElement {
  const script = document.createElement('script')
  script.id = KAKAO_MAP_SCRIPT_ID
  script.async = true
  script.dataset[KAKAO_MAP_SCRIPT_STATE] = 'loading'
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JAVASCRIPT_KEY ?? '')}&libraries=services&autoload=false`
  return script
}

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
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

  let script = document.getElementById(
    KAKAO_MAP_SCRIPT_ID,
  ) as HTMLScriptElement | null

  if (
    script &&
    !window.kakao?.maps &&
    script.dataset[KAKAO_MAP_SCRIPT_STATE] !== 'loading'
  ) {
    script.remove()
    script = null
  }

  const shouldAppendScript = !script
  script ??= createKakaoMapsScript()

  kakaoMapsPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    let isSettled = false

    const cleanUpListeners = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
      clearTimeout(timeoutId)
    }

    const succeed = (maps: KakaoMapsNamespace) => {
      if (isSettled) {
        return
      }

      isSettled = true
      script.dataset[KAKAO_MAP_SCRIPT_STATE] = 'loaded'
      cleanUpListeners()
      resolve(maps)
    }

    const fail = (message: string) => {
      if (isSettled) {
        return
      }

      isSettled = true
      script.dataset[KAKAO_MAP_SCRIPT_STATE] = 'failed'
      cleanUpListeners()
      script.remove()
      reject(new Error(message))
    }

    const finishLoading = () => {
      const maps = window.kakao?.maps
      if (!maps) {
        fail('카카오 지도 서비스를 불러오지 못했습니다.')
        return
      }

      maps.load(() => {
        const loadedMaps = window.kakao?.maps
        if (loadedMaps?.services) {
          succeed(loadedMaps)
        } else {
          fail('카카오 장소 검색 서비스를 사용할 수 없습니다.')
        }
      })
    }

    function handleLoad() {
      finishLoading()
    }

    function handleError() {
      fail('카카오 지도 서비스를 불러오지 못했습니다.')
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)
    const timeoutId = setTimeout(() => {
      fail('카카오 지도 서비스 연결 시간이 초과되었습니다. 다시 시도해 주세요.')
    }, KAKAO_MAP_LOAD_TIMEOUT_MS)

    if (shouldAppendScript) {
      document.head.append(script)
    } else if (window.kakao?.maps) {
      finishLoading()
    }
  }).catch((error) => {
    kakaoMapsPromise = undefined
    throw error
  })

  return kakaoMapsPromise
}
