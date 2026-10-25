import { normalizeResolution, parseNumber, validateSpecs } from './normalize'
import type { PartialSpecs } from './types'

const findValue = (text: string, labels: string[]) => {
  for (const label of labels) {
    const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:\\-]?\\s*([^\\n]+)`, 'i')
    const match = pattern.exec(text)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return null
}

export function parsePastedSpecs(text: string): PartialSpecs {
  if (!text.trim()) return {}
  const displayText = findValue(text, ['Display(?:\\s+size)?', 'Screen(?:\\s+size)?'])
  const resolutionText = findValue(text, ['Resolution'])
  const refreshText = findValue(text, ['Refresh\\s+rate'])
  const brightnessText = findValue(text, ['Brightness'])
  const protectionText = findValue(text, ['Display\\s+protection', 'Protection'])
  const batteryText = findValue(text, ['Battery(?:\\s+capacity)?'])
  const chargingText = findValue(text, ['Charging(?:\\s+speed)?'])
  const chipset = findValue(text, ['Chipset', 'SoC', 'Processor'])
  const cpu = findValue(text, ['CPU'])
  const gpu = findValue(text, ['GPU'])
  const rearCamera = findValue(text, ['Rear\\s+cameras?', 'Main\\s+camera', 'Rear\\s+camera'])
  const frontCamera = findValue(text, ['Front\\s+camera', 'Selfie\\s+camera'])
  const os = findValue(text, ['Operating\\s+system', 'OS', 'Software'])
  const dimensionsText = findValue(text, ['Dimensions'])
  const weightText = findValue(text, ['Weight'])
  const waterRating = findValue(text, ['Water\\s+resistance', 'IP\\s+rating'])
  const ramText = findValue(text, ['RAM', 'Memory'])
  const storageText = findValue(text, ['Storage'])

  const parsed: Record<string, unknown> = {}
  if (displayText || resolutionText || refreshText || brightnessText || protectionText) {
    parsed.display = {
      sizeInches: displayText ? parseNumber(displayText, /([\d.]+)\s*(?:inches|inch|["″])/i) : null,
      resolution: resolutionText ? normalizeResolution(resolutionText) : null,
      type: displayText?.match(/\b(?:AMOLED|OLED|LCD|IPS|LTPO|Super\s+Retina(?:\s+XDR)?|Dynamic\s+AMOLED)[\w\s-]*/i)?.[0]?.trim() ?? null,
      refreshRateHz: refreshText ? parseNumber(refreshText, /([\d.]+)\s*Hz/i) : null,
      brightnessNits: brightnessText ? parseNumber(brightnessText, /([\d,]+)\s*(?:nits?|cd\/m²)/i) : null,
      protection: protectionText,
    }
  }
  if (chipset) parsed.chipset = chipset
  if (cpu) parsed.cpu = cpu
  if (gpu) parsed.gpu = gpu
  if (batteryText) parsed.batteryMah = parseNumber(batteryText, /([\d,]+)\s*mAh/i)
  if (chargingText) parsed.chargingWatts = parseNumber(chargingText, /([\d.]+)\s*W/i)
  const fiveGText = findValue(text, ['5G'])
  if (fiveGText !== null) parsed.fiveG = !/\b(?:no|not supported|false)\b/i.test(fiveGText)
  else if (/\b5g\b/i.test(text)) parsed.fiveG = !/\b(?:no|not supported|false)\s+5g\b/i.test(text)
  if (/\bnfc\b/i.test(text)) parsed.nfc = !/\bno nfc\b/i.test(text)
  if (/\besim\b/i.test(text)) parsed.esim = !/\bno esim\b/i.test(text)
  if (rearCamera) {
    const megapixels = [...rearCamera.matchAll(/([\d.]+)\s*MP/gi)].map((match, index) => ({ name: index === 0 ? 'Main' : `Camera ${index + 1}`, megapixels: Number(match[1]), details: null }))
    parsed.rearCamera = megapixels.length ? megapixels : [{ name: 'Rear camera', megapixels: null, details: rearCamera }]
  }
  if (frontCamera) parsed.frontCamera = { megapixels: parseNumber(frontCamera, /([\d.]+)\s*MP/i), details: frontCamera }
  if (os) parsed.os = os
  if (dimensionsText) {
    const compact = /([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)\s*mm/i.exec(dimensionsText)
    const numbers = compact ? [compact[1], compact[2], compact[3]].map(Number) : [...dimensionsText.matchAll(/([\d.]+)\s*mm/gi)].map((match) => Number(match[1]))
    if (numbers.length >= 3) parsed.dimensionsMm = { height: numbers[0] ?? 0, width: numbers[1] ?? 0, depth: numbers[2] ?? 0 }
  }
  if (weightText) parsed.weightGrams = parseNumber(weightText, /([\d.]+)\s*g(?:rams?)?/i)
  if (waterRating) parsed.waterRating = waterRating.match(/IP\s*\d{2}/i)?.[0]?.replaceAll(' ', '') ?? waterRating
  if (ramText) parsed.ramGb = parseNumber(ramText, /([\d.]+)\s*GB/i)
  if (storageText) parsed.storageGb = parseNumber(storageText, /([\d.]+)\s*GB/i)
  return validateSpecs(parsed).specs
}
