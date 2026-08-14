import {
  ALL_CATEGORY_FILTER,
  isUnlimitedBudget,
  type CategoryFilter,
} from '../../../entities/restaurant'

export function getCandidateDescription(
  category: CategoryFilter | null,
  budget: number | null,
): string {
  if (category === null || budget === null) {
    return '조건을 모두 선택해 주세요'
  }

  const hasCategoryLimit = category !== ALL_CATEGORY_FILTER
  const hasBudgetLimit = !isUnlimitedBudget(budget)

  if (!hasCategoryLimit && !hasBudgetLimit) {
    return '모든 후보가 참여해요'
  }

  const categoryText = hasCategoryLimit ? category : '전체 음식'

  if (!hasBudgetLimit) {
    return `${categoryText} 후보가 참여해요`
  }

  return `${budget.toLocaleString('ko-KR')}원 이하 ${categoryText} 후보가 참여해요`
}
