import { useCallback, useRef, useState } from 'react'
import {
  isLocationSearchConfigured,
  searchLocations,
  type LocationSearchResult,
} from '../services/kakaoLocationSearch'

export type LocationSearchStatus =
  | 'idle'
  | 'searching'
  | 'success'
  | 'empty'
  | 'error'
  | 'unconfigured'

export function useLocationSearch() {
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [status, setStatus] = useState<LocationSearchStatus>(
    isLocationSearchConfigured ? 'idle' : 'unconfigured',
  )
  const [error, setError] = useState<string>()
  const requestIdRef = useRef(0)

  const search = useCallback(async (query: string) => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery || !isLocationSearchConfigured) {
      return
    }

    const requestId = ++requestIdRef.current
    setStatus('searching')
    setError(undefined)

    try {
      const nextResults = await searchLocations(normalizedQuery)
      if (requestId !== requestIdRef.current) {
        return
      }
      setResults(nextResults)
      setStatus(nextResults.length > 0 ? 'success' : 'empty')
    } catch (searchError) {
      if (requestId !== requestIdRef.current) {
        return
      }
      setResults([])
      setError(
        searchError instanceof Error
          ? searchError.message
          : '위치 검색 중 문제가 발생했습니다.',
      )
      setStatus('error')
    }
  }, [])

  const clear = useCallback(() => {
    requestIdRef.current += 1
    setResults([])
    setError(undefined)
    setStatus(isLocationSearchConfigured ? 'idle' : 'unconfigured')
  }, [])

  return { results, status, error, search, clear }
}
