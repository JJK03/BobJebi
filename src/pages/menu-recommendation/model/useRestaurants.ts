import { useEffect, useState } from 'react'
import {
  loadNearbyRestaurants,
  loadRestaurantManifest,
  type Restaurant,
  type RestaurantSource,
} from '../../../entities/restaurant'
import type { Coordinates } from '../../../shared/lib/geo'

type LoadingStatus = 'loading' | 'waiting' | 'success' | 'error'

interface RestaurantState {
  requestKey: string
  restaurants: Restaurant[]
  totalCount: number
  status: LoadingStatus
  error: string
}

export function useRestaurants(
  source: RestaurantSource,
  position?: Coordinates,
  maxDistanceMeters?: number,
) {
  const requestKey = `${source}:${position?.latitude ?? ''}:${position?.longitude ?? ''}:${maxDistanceMeters ?? ''}`
  const [state, setState] = useState<RestaurantState>({
    requestKey,
    restaurants: [],
    totalCount: 0,
    status: 'loading',
    error: '',
  })

  useEffect(() => {
    const controller = new AbortController()

    loadRestaurantManifest(source, controller.signal)
      .then(async (manifest) => {
        if (!position || maxDistanceMeters === undefined) {
          setState({
            requestKey,
            restaurants: [],
            totalCount: manifest.totalCount,
            status: 'waiting',
            error: '',
          })
          return
        }

        const restaurants = await loadNearbyRestaurants(
          manifest,
          position,
          maxDistanceMeters,
          controller.signal,
        )
        setState({
          requestKey,
          restaurants,
          totalCount: manifest.totalCount,
          status: 'success',
          error: '',
        })
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          return
        }

        setState({
          requestKey,
          restaurants: [],
          totalCount: 0,
          status: 'error',
          error:
            reason instanceof Error
              ? reason.message
              : '식당 데이터를 불러오지 못했습니다.',
        })
      })

    return () => controller.abort()
  }, [
    source,
    position?.latitude,
    position?.longitude,
    maxDistanceMeters,
    requestKey,
    position,
  ])

  if (state.requestKey !== requestKey) {
    return {
      restaurants: [],
      totalCount: state.requestKey.startsWith(`${source}:`)
        ? state.totalCount
        : 0,
      status: 'loading' as const,
      error: '',
    }
  }

  return {
    restaurants: state.restaurants,
    totalCount: state.totalCount,
    status: state.status,
    error: state.error,
  }
}
