import type { CategoryFilter } from '../domain/restaurant'

export function getCandidateDescription(
  category: CategoryFilter,
  budget: number,
): string {
  const hasCategoryLimit = category !== '전체'
  const hasBudgetLimit = Number.isFinite(budget)

  if (!hasCategoryLimit && !hasBudgetLimit) {
    return '모든 후보가 참여해요'
  }

  const categoryText = hasCategoryLimit ? category : '전체 음식'

  if (!hasBudgetLimit) {
    return `${categoryText} 후보가 참여해요`
  }

  return `${budget.toLocaleString('ko-KR')}원 이하 ${categoryText} 후보가 참여해요`
}
