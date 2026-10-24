import { shop } from '../data/shop'
import type { TradeInAnswers, TradeInEstimate } from '../types'

export const createWhatsAppUrl = (message: string, number = shop.whatsapp[0]) => {
  const normalizedNumber = number?.replace(/\D/g, '')
  if (!normalizedNumber) throw new Error('A valid WhatsApp contact number is required.')
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`
}

export const phoneOrderMessage = (model: string, storage: string, color: string, price: string, link: string, storeName = shop.name) =>
  `Hello ${storeName}, I’m interested in:\n${model} | ${storage} | ${color} | ${price}\nLink: ${link}`

export const tradeInMessage = (phone: string, storage: string, answers: TradeInAnswers, result: TradeInEstimate, storeName = shop.name) => {
  const resultText = result.eligible ? `${result.min?.toLocaleString()}–${result.max?.toLocaleString()} ETB (estimate)` : 'Not eligible until unlocked'
  return `Hello ${storeName}, I’d like an in-store trade-in inspection.\nPhone: ${phone} · ${storage}\nCondition: ${answers.condition.replace('_', ' ')}\nScreen: ${answers.screen.replace('_', ' ')}\nBody: ${answers.body.replace('_', ' ')}\nBattery: ${answers.battery.replace('_', ' ')}\nPowers on: ${answers.powersOn ? 'Yes' : 'No'}\nIssues: ${answers.issues.join(', ') || 'None'}\nAccessories: ${answers.accessories === 'full' ? 'Box and charger' : 'Phone only'}\nLocked: ${answers.locked ? 'Yes' : 'No'}\nEstimated value: ${resultText}`
}
