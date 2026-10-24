import type {
  Accessories, BatteryCondition, BodyCondition, Condition, ScreenCondition, TradeInAnswers, TradeInEstimate,
} from '../types'

export interface TradeInConfig {
  condition: Record<Condition, number>
  screen: Record<ScreenCondition, number>
  body: Record<BodyCondition, number>
  battery: Record<BatteryCondition, number>
  accessories: Record<Accessories, number>
  issuePenalty: number,
  maxIssuePenalty: number,
  minimumValue: number,
  range: { min: number; max: number },
}

export const tradeInConfig: TradeInConfig = {
  condition: { like_new: 1, good: 0.9, fair: 0.75, poor: 0.55 },
  screen: { perfect: 1, light_scratches: 0.93, cracked: 0.65 },
  body: { perfect: 1, scratched: 0.92, cracked_bent: 0.75 },
  battery: { '90_plus': 1, '80_89': 0.94, below_80: 0.85, unknown: 0.92 },
  accessories: { full: 1, phone_only: 0.95 },
  issuePenalty: 0.05,
  maxIssuePenalty: 0.4,
  minimumValue: 0.1,
  range: { min: 0.92, max: 1.05 },
}

const roundCurrency = (amount: number) => Math.round(amount / 100) * 100

export function estimateTradeIn(baseValue: number, answers: TradeInAnswers, config: TradeInConfig = tradeInConfig): TradeInEstimate {
  if (!Number.isFinite(baseValue) || baseValue <= 0) throw new Error('Trade-in base value must be a positive finite number.')
  if (answers.locked) return { eligible: false, estimate: null, min: null, max: null, deductions: [], baseValue }

  const multipliers = [
    ['Overall condition', config.condition[answers.condition]],
    ['Screen condition', config.screen[answers.screen]],
    ['Body condition', config.body[answers.body]],
    ['Battery health', config.battery[answers.battery]],
    ['Original box and charger', config.accessories[answers.accessories]],
  ] as const
  const conditionMultiplier = multipliers.reduce((total, [, multiplier]) => total * multiplier, 1)
  const issuePenalty = Math.min(answers.issues.length * config.issuePenalty, config.maxIssuePenalty)
  const estimated = Math.max(baseValue * config.minimumValue, baseValue * (conditionMultiplier - issuePenalty))
  const deductions: TradeInEstimate['deductions'] = multipliers.filter(([, multiplier]) => multiplier < 1).map(([label, multiplier]) => ({ label, amount: roundCurrency(baseValue * (1 - multiplier)) }))
  if (issuePenalty > 0) deductions.push({ label: 'Functional issues', amount: roundCurrency(baseValue * issuePenalty) })
  const estimate = roundCurrency(estimated)
  return {
    eligible: true,
    estimate,
    min: roundCurrency(estimate * config.range.min),
    max: roundCurrency(estimate * config.range.max),
    deductions,
    baseValue,
  }
}
