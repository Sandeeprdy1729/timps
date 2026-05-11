/**
 * TIMPS Rate Limit Messages Service
 * Centralized rate limit message generation
 */

export const RATE_LIMIT_ERROR_PREFIXES = [
  "You've hit your",
  "You've used",
  "You're now using extra usage",
  "You're close to",
  "You're out of extra usage",
] as const

export function isRateLimitErrorMessage(text: string): boolean {
  return RATE_LIMIT_ERROR_PREFIXES.some(prefix => text.startsWith(prefix))
}

export type RateLimitMessage = {
  message: string
  severity: 'error' | 'warning'
}

export type RateLimitStatus = 'ok' | 'warning' | 'error' | 'rejected'

export type RateLimitState = {
  status: RateLimitStatus
  utilization?: number
  resetsAt?: Date
  rateLimitType?: 'daily' | 'weekly' | 'monthly' | 'realtime'
  isOverage?: boolean
  overageResetsAt?: Date
}

const DEFAULT_WARNING_THRESHOLD = 0.7

export function getRateLimitMessage(
  limits: RateLimitState,
  model?: string,
): RateLimitMessage | null {
  if (limits.status === 'ok') {
    return null
  }

  if (limits.status === 'rejected') {
    return {
      message: formatLimitReachedMessage(limits),
      severity: 'error',
    }
  }

  if (limits.status === 'warning') {
    if (
      limits.utilization !== undefined &&
      limits.utilization < DEFAULT_WARNING_THRESHOLD
    ) {
      return null
    }

    return {
      message: formatWarningMessage(limits),
      severity: 'warning',
    }
  }

  if (limits.isOverage) {
    if (limits.utilization !== undefined && limits.utilization >= 0.9) {
      return {
        message: "You're close to your extra usage spending limit",
        severity: 'warning',
      }
    }
    return null
  }

  return null
}

export function getRateLimitErrorMessage(
  limits: RateLimitState,
  model?: string,
): string | null {
  const message = getRateLimitMessage(limits, model)
  if (message && message.severity === 'error') {
    return message.message
  }
  return null
}

export function getRateLimitWarning(
  limits: RateLimitState,
  model?: string,
): string | null {
  const message = getRateLimitMessage(limits, model)
  if (message && message.severity === 'warning') {
    return message.message
  }
  return null
}

function formatLimitReachedMessage(limits: RateLimitState): string {
  const limitName = getLimitName(limits.rateLimitType)
  const resetTime = limits.resetsAt ? formatResetTime(limits.resetsAt) : ''

  if (limits.isOverage) {
    return `You're out of extra usage${resetTime}`
  }

  return `You've hit your ${limitName}${resetTime}`
}

function formatWarningMessage(limits: RateLimitState): string {
  const limitName = getLimitName(limits.rateLimitType)
  const used = limits.utilization
    ? Math.floor(limits.utilization * 100)
    : undefined
  const resetTime = limits.resetsAt ? formatResetTime(limits.resetsAt) : ''

  if (used !== undefined && resetTime) {
    return `You've used ${used}% of your ${limitName}${resetTime}`
  }

  if (used !== undefined) {
    return `You've used ${used}% of your ${limitName}`
  }

  if (resetTime) {
    return `Approaching ${limitName}${resetTime}`
  }

  return `Approaching ${limitName}`
}

function getLimitName(
  rateLimitType?: 'daily' | 'weekly' | 'monthly' | 'realtime',
): string {
  switch (rateLimitType) {
    case 'daily':
      return 'daily limit'
    case 'weekly':
      return 'weekly limit'
    case 'monthly':
      return 'monthly limit'
    case 'realtime':
      return 'session limit'
    default:
      return 'usage limit'
  }
}

function formatResetTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins <= 0) {
    return ''
  }

  let timeStr = ''
  if (diffDays > 0) {
    timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''}`
  } else if (diffHours > 0) {
    timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''}`
  } else {
    timeStr = `${diffMins} minute${diffMins > 1 ? 's' : ''}`
  }

  return ` · resets ${timeStr}`
}

export function getUsingOverageText(limits: RateLimitState): string {
  const limitName = getLimitName(limits.rateLimitType)
  const resetTime = limits.resetsAt ? formatResetTime(limits.resetsAt) : ''

  if (!limitName) {
    return 'Now using extra usage'
  }

  return `You're now using extra usage${resetTime}`
}

class RateLimitService {
  private static instance: RateLimitService
  private currentLimits: RateLimitState = { status: 'ok' }
  private listeners: Array<(limits: RateLimitState) => void> = []

  private constructor() {}

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService()
    }
    return RateLimitService.instance
  }

  updateLimits(limits: RateLimitState): void {
    this.currentLimits = limits
    this.notifyListeners()
  }

  getCurrentLimits(): RateLimitState {
    return { ...this.currentLimits }
  }

  getMessage(model?: string): RateLimitMessage | null {
    return getRateLimitMessage(this.currentLimits, model)
  }

  getErrorMessage(model?: string): string | null {
    return getRateLimitErrorMessage(this.currentLimits, model)
  }

  getWarningMessage(model?: string): string | null {
    return getRateLimitWarning(this.currentLimits, model)
  }

  onUpdate(listener: (limits: RateLimitState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentLimits)
    }
  }
}

export function getRateLimitService(): RateLimitService {
  return RateLimitService.getInstance()
}
