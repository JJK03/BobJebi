import { useCallback, useState } from 'react'
import type { Coordinates } from '../domain/restaurant'

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'success'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported'
  | 'error'

export function useGeolocation() {
  const [position, setPosition] = useState<Coordinates>()
  const [status, setStatus] = useState<LocationStatus>('idle')

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
        setStatus('success')
      },
      (geolocationError) => {
        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          setStatus('denied')
        } else if (
          geolocationError.code === geolocationError.POSITION_UNAVAILABLE
        ) {
          setStatus('unavailable')
        } else if (geolocationError.code === geolocationError.TIMEOUT) {
          setStatus('timeout')
        } else {
          setStatus('error')
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  return { position, status, requestLocation }
}
