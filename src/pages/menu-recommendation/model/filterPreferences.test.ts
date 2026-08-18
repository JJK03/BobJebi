import { describe, expect, it } from 'vitest'
import { UNLIMITED_BUDGET } from '../../../entities/restaurant'
import {
  createEmptyFilterPreferences,
  parseFilterPreferences,
  serializeFilterPreferences,
} from './filterPreferences'

describe('filterPreferences', () => {
  it('저장된 선택 조건을 복원한다', () => {
    const preferences = {
      category: '중식' as const,
      budget: 15_000,
      travelMode: 'walking' as const,
      travelTimeLimit: 20 as const,
    }

    expect(parseFilterPreferences(serializeFilterPreferences(preferences))).toEqual(
      preferences,
    )
  })

  it('예산 제한 없음을 손실 없이 저장한다', () => {
    const preferences = {
      ...createEmptyFilterPreferences(),
      category: '전체' as const,
      budget: UNLIMITED_BUDGET,
    }

    expect(parseFilterPreferences(serializeFilterPreferences(preferences))).toEqual(
      preferences,
    )
  })

  it('세분화된 음식 종류 선택을 복원한다', () => {
    const preferences = {
      ...createEmptyFilterPreferences(),
      category: '분식·간편식' as const,
    }

    expect(parseFilterPreferences(serializeFilterPreferences(preferences))).toEqual(
      preferences,
    )
  })

  it('깨지거나 허용되지 않은 값은 미선택으로 복구한다', () => {
    expect(parseFilterPreferences('not-json')).toEqual(
      createEmptyFilterPreferences(),
    )
    expect(
      parseFilterPreferences(
        JSON.stringify({
          category: '분식',
          budget: 99_000,
          travelMode: 'flying',
          travelTimeLimit: 999,
        }),
      ),
    ).toEqual(createEmptyFilterPreferences())

    expect(
      parseFilterPreferences(
        JSON.stringify({
          category: '기타 음식점',
          budget: null,
          travelMode: null,
          travelTimeLimit: null,
        }),
      ),
    ).toEqual(createEmptyFilterPreferences())
  })
})
