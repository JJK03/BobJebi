import { describe, expect, it } from 'vitest'
import { pickRandomItem } from './random'

describe('pickRandomItem', () => {
  const candidates = ['첫 번째', '두 번째', '세 번째']

  it('전체 후보 배열에서 주입한 난수에 해당하는 항목을 선택한다', () => {
    expect(pickRandomItem(candidates, () => 0)).toBe('첫 번째')
    expect(pickRandomItem(candidates, () => 0.5)).toBe('두 번째')
    expect(pickRandomItem(candidates, () => 0.999)).toBe('세 번째')
  })

  it('후보가 없으면 undefined를 반환한다', () => {
    expect(pickRandomItem([], () => 0)).toBeUndefined()
  })
})
