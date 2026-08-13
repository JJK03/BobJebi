import { useEffect, useState } from 'react'
import { loadRestaurants } from '../data/loadRestaurants'
import type { Restaurant } from '../domain/restaurant'

type LoadingStatus = 'loading' | 'success' | 'error'

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [status, setStatus] = useState<LoadingStatus>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    loadRestaurants(controller.signal)
      .then((data) => {
        setRestaurants(data)
        setStatus('success')
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          return
        }

        setError(
          reason instanceof Error
            ? reason.message
            : '식당 데이터를 불러오지 못했습니다.',
        )
        setStatus('error')
      })

    return () => controller.abort()
  }, [])

  return { restaurants, status, error }
}
