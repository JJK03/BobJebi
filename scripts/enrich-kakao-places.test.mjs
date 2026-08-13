import { describe, expect, it } from 'vitest'
import {
  normalizePlaceName,
  selectKakaoPlace,
} from './enrich-kakao-places.mjs'

describe('normalizePlaceName', () => {
  it('공백과 회사 표기를 제거해 이름을 비교할 수 있게 한다', () => {
    expect(normalizePlaceName('(주) 행복 식당')).toBe('행복식당')
  })
})

describe('selectKakaoPlace', () => {
  const restaurant = { name: '행복식당' }

  it('이름이 같고 500m 안에서 가장 가까운 장소를 선택한다', () => {
    const selected = selectKakaoPlace(
      [
        { id: 'far', place_name: '행복식당', distance: '420' },
        { id: 'near', place_name: '행복 식당', distance: '35' },
        { id: 'wrong', place_name: '행복분식', distance: '5' },
      ],
      restaurant,
    )

    expect(selected?.id).toBe('near')
  })

  it('이름이 다르거나 너무 먼 장소는 연결하지 않는다', () => {
    expect(
      selectKakaoPlace(
        [
          { id: 'wrong', place_name: '행복분식', distance: '10' },
          { id: 'far', place_name: '행복식당', distance: '700' },
        ],
        restaurant,
      ),
    ).toBeUndefined()
  })
})
