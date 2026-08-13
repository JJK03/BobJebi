import { describe, expect, it } from 'vitest'
import { getCandidateDescription } from './candidateDescription'

describe('getCandidateDescription', () => {
  it('전체 음식과 예산 제한 없음일 때만 모든 후보라고 안내한다', () => {
    expect(getCandidateDescription('전체', Infinity)).toBe(
      '모든 후보가 참여해요',
    )
  })

  it('선택한 예산과 음식 종류를 문장에 반영한다', () => {
    expect(getCandidateDescription('중식', 15_000)).toBe(
      '15,000원 이하 중식 후보가 참여해요',
    )
    expect(getCandidateDescription('기타요식업', 20_000)).toBe(
      '20,000원 이하 기타요식업 후보가 참여해요',
    )
  })

  it('카테고리나 예산 중 하나만 제한한 경우도 자연스럽게 안내한다', () => {
    expect(getCandidateDescription('전체', 10_000)).toBe(
      '10,000원 이하 전체 음식 후보가 참여해요',
    )
    expect(getCandidateDescription('한식', Infinity)).toBe(
      '한식 후보가 참여해요',
    )
  })
})
