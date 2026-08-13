import { useEffect, useState } from 'react'
import {
  createEmptyFilterPreferences,
  parseFilterPreferences,
  serializeFilterPreferences,
  type FilterPreferences,
} from '../utils/filterPreferences'

const STORAGE_KEY = 'menu-recs:filter-preferences:v1'

function loadFilterPreferences(): FilterPreferences {
  try {
    return parseFilterPreferences(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return createEmptyFilterPreferences()
  }
}

export function useFilterPreferences() {
  const [preferences, setPreferences] = useState<FilterPreferences>(
    loadFilterPreferences,
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        serializeFilterPreferences(preferences),
      )
    } catch {
      // 저장 공간이 차단되어도 필터 사용은 계속할 수 있습니다.
    }
  }, [preferences])

  const updatePreference = <Key extends keyof FilterPreferences>(
    key: Key,
    value: FilterPreferences[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  const resetPreferences = () => {
    setPreferences(createEmptyFilterPreferences())
  }

  return { preferences, updatePreference, resetPreferences }
}
