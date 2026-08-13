import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KakaoMapsNamespace } from './kakaoMapsSdk'

interface FakeScript {
  dispatch: (type: 'load' | 'error') => void
  wasRemoved: () => boolean
}

function createFakeDocument() {
  let activeScript: HTMLScriptElement | null = null
  const scripts: FakeScript[] = []

  const documentMock = {
    getElementById: () => activeScript,
    createElement: () => {
      let removed = false
      const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
      const element = {
        id: '',
        async: false,
        src: '',
        dataset: {},
        addEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          const typeListeners = listeners.get(type) ?? new Set()
          typeListeners.add(listener)
          listeners.set(type, typeListeners)
        },
        removeEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject,
        ) => {
          listeners.get(type)?.delete(listener)
        },
        remove: () => {
          removed = true
          if (activeScript === element) {
            activeScript = null
          }
        },
      } as unknown as HTMLScriptElement

      scripts.push({
        dispatch: (type) => {
          for (const listener of listeners.get(type) ?? []) {
            if (typeof listener === 'function') {
              listener({ type } as Event)
            } else {
              listener.handleEvent({ type } as Event)
            }
          }
        },
        wasRemoved: () => removed,
      })
      return element
    },
    head: {
      append: (element: HTMLScriptElement) => {
        activeScript = element
      },
    },
  }

  return { documentMock, scripts }
}

describe('loadKakaoMaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('SDK 로딩 실패 시 스크립트를 제거하고 다음 호출에서 다시 시도한다', async () => {
    const { documentMock, scripts } = createFakeDocument()
    const windowMock: { kakao?: { maps: KakaoMapsNamespace } } = {}
    vi.stubGlobal('document', documentMock)
    vi.stubGlobal('window', windowMock)
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', 'test-javascript-key')
    vi.resetModules()

    const { loadKakaoMaps } = await import('./kakaoMapsSdk')
    const firstAttempt = loadKakaoMaps()
    scripts[0].dispatch('error')

    await expect(firstAttempt).rejects.toThrow(
      '카카오 지도 서비스를 불러오지 못했습니다.',
    )
    expect(scripts[0].wasRemoved()).toBe(true)

    const secondAttempt = loadKakaoMaps()
    const maps = {
      load: (callback: () => void) => callback(),
      services: {},
    } as unknown as KakaoMapsNamespace
    windowMock.kakao = { maps }
    scripts[1].dispatch('load')

    await expect(secondAttempt).resolves.toBe(maps)
    expect(scripts).toHaveLength(2)
  })
})
