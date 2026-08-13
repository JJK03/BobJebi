import { useCallback, useEffect, useRef, useState } from 'react'
import type { Coordinates } from '../domain/restaurant'

export type LocationStatus =
  | 'checking'
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
  const [status, setStatus] = useState<LocationStatus>(() =>
    navigator.geolocation ? 'checking' : 'unsupported',
  )
  const requestInFlight = useRef(false)

  const requestLocation = useCallback(() => {
    if (requestInFlight.current) {
      return
    }

    if (!navigator.geolocation) {
      setStatus('unsupported')
      return
    }

    requestInFlight.current = true
    setStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        requestInFlight.current = false
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
        })
        setStatus('success')
      },
      (geolocationError) => {
        requestInFlight.current = false

        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          setPosition(undefined)
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

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    let isCancelled = false

    if (!navigator.permissions?.query) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setStatus('idle')
        }
      })
      return () => {
        isCancelled = true
      }
    }

    let permissionStatus: PermissionStatus | undefined

    const applyPermissionState = () => {
      if (isCancelled || !permissionStatus) {
        return
      }

      if (permissionStatus.state === 'granted') {
        requestLocation()
      } else if (permissionStatus.state === 'denied') {
        setPosition(undefined)
        setStatus('denied')
      } else if (!requestInFlight.current) {
        setStatus('idle')
      }
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (isCancelled) {
          return
        }

        permissionStatus = result
        applyPermissionState()
        permissionStatus.addEventListener('change', applyPermissionState)
      })
      .catch(() => {
        if (!isCancelled) {
          setStatus('idle')
        }
      })

    return () => {
      isCancelled = true
      permissionStatus?.removeEventListener('change', applyPermissionState)
    }
  }, [requestLocation])

  return { position, status, requestLocation }
}
