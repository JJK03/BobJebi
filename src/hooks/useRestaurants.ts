import { useEffect, useState } from 'react'
import { loadRestaurants } from '../data/loadRestaurants'
import type { Restaurant } from '../domain/restaurant'
import type { RestaurantSource } from '../domain/restaurantSource'

type LoadingStatus = 'loading' | 'success' | 'error'

interface RestaurantState {
  source: RestaurantSource
  restaurants: Restaurant[]
  status: LoadingStatus
  error: string
}

export function useRestaurants(source: RestaurantSource) {
  const [state, setState] = useState<RestaurantState>({
    source,
    restaurants: [],
    status: 'loading',
    error: '',
  })

  useEffect(() => {
    const controller = new AbortController()

    loadRestaurants(source, controller.signal)
      .then((data) => {
        setState({
          source,
          restaurants: data,
          status: 'success',
          error: '',
        })
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          return
        }

        setState({
          source,
          restaurants: [],
          status: 'error',
          error:
            reason instanceof Error
              ? reason.message
              : '식당 데이터를 불러오지 못했습니다.',
        })
      })

    return () => controller.abort()
  }, [source])

  if (state.source !== source) {
    return { restaurants: [], status: 'loading' as const, error: '' }
  }

  return {
    restaurants: state.restaurants,
    status: state.status,
    error: state.error,
  }
}
