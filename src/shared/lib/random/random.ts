export function pickRandomItem<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T | undefined {
  if (items.length === 0) {
    return undefined
  }

  const value = random()
  const safeValue = Math.min(Math.max(value, 0), 1 - Number.EPSILON)
  return items[Math.floor(safeValue * items.length)]
}
