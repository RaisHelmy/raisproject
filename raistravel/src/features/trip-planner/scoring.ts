import type { CostBreakdown, FatigueReport, PlannerInput, TransportPlan, TripScore } from '../../types'
import { DEST_MAP } from '../../data/destinations'
import { totalBudget } from '../budget/engine'

export function computeFatigue(input: PlannerInput, transport: TransportPlan, hotelChanges: number): FatigueReport {
  const hours = transport.totalDriveMin / 60
  const hoursPerDay = hours / Math.max(1, input.days)
  const changePenalty = hotelChanges / Math.max(1, input.days)
  const score = hoursPerDay + changePenalty * 2
  const level: FatigueReport['level'] = score > 2.9 ? 'high' : score > 1.8 ? 'moderate' : 'low'
  let advice: string | undefined
  if (level === 'high') {
    const longest = [...input.stops].sort((a, b) => {
      const da = DEST_MAP[a]?.recommendedNights[1] ?? 2
      const db = DEST_MAP[b]?.recommendedNights[1] ?? 2
      return db - da
    })[0]
    const name = DEST_MAP[longest]?.name ?? 'your main stop'
    advice = `You have ${hours.toFixed(1)} hours of transportation over ${input.days} days. Consider staying an additional night in ${name} or dropping a stop.`
  } else if (level === 'moderate') {
    advice = 'A balanced pace — keep one relaxed morning per two travel days.'
  }
  return { level, transportHours: Math.round(hours * 10) / 10, hotelChanges, advice }
}

export function computeScore(
  input: PlannerInput,
  breakdown: CostBreakdown,
  transport: TransportPlan,
  fatigue: FatigueReport,
): TripScore {
  const budget = totalBudget(input)
  const utilization = budget > 0 ? breakdown.total / budget : 1
  const budgetScore = utilization <= 1
    ? Math.round(100 - Math.max(0, 0.55 - Math.abs(0.85 - utilization)) * 40)
    : Math.max(20, Math.round(100 - (utilization - 1) * 180))

  const hoursPerDay = transport.totalDriveMin / 60 / Math.max(1, input.days)
  const travelTimeScore = Math.max(30, Math.round(100 - hoursPerDay * 22))

  const convenienceScore = Math.max(35, Math.round(100 - fatigue.hotelChanges * 7 - (transport.mode === 'mixed' ? 4 : 0)))

  // Experience: how well destinations match selected interests
  let matched = 0
  let possible = 0
  for (const s of input.stops) {
    const d = DEST_MAP[s]
    if (!d) continue
    possible += Math.max(1, input.interests.length)
    matched += input.interests.filter((i) => d.tags.includes(i)).length || 1
  }
  const experienceScore = possible > 0 ? Math.min(98, Math.round(60 + (matched / possible) * 45)) : 80

  const total = Math.round(budgetScore * 0.3 + convenienceScore * 0.2 + experienceScore * 0.3 + travelTimeScore * 0.2)
  return { total, budget: budgetScore, convenience: convenienceScore, experience: experienceScore, travelTime: travelTimeScore }
}
