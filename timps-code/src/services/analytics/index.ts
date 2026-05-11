/**
 * TIMPS Analytics Service
 * Analytics tracking service with event queue and sink management
 */

export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = never

export type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED = never

type LogEventMetadata = { [key: string]: boolean | number | undefined | string }

type QueuedEvent = {
  eventName: string
  metadata: LogEventMetadata
  async: boolean
}

export type AnalyticsSink = {
  logEvent: (eventName: string, metadata: LogEventMetadata) => void
  logEventAsync: (eventName: string, metadata: LogEventMetadata) => Promise<void>
}

const eventQueue: QueuedEvent[] = []
let sink: AnalyticsSink | null = null

export function attachAnalyticsSink(newSink: AnalyticsSink): void {
  if (sink !== null) {
    return
  }
  sink = newSink

  if (eventQueue.length > 0) {
    const queuedEvents = [...eventQueue]
    eventQueue.length = 0

    queueMicrotask(async () => {
      for (const event of queuedEvents) {
        if (event.async) {
          await sink!.logEventAsync(event.eventName, event.metadata)
        } else {
          sink!.logEvent(event.eventName, event.metadata)
        }
      }
    })
  }
}

export function logEvent(
  eventName: string,
  metadata: LogEventMetadata,
): void {
  if (sink === null) {
    eventQueue.push({ eventName, metadata, async: false })
    return
  }
  sink.logEvent(eventName, metadata)
}

export async function logEventAsync(
  eventName: string,
  metadata: LogEventMetadata,
): Promise<void> {
  if (sink === null) {
    eventQueue.push({ eventName, metadata, async: true })
    return
  }
  await sink.logEventAsync(eventName, metadata)
}

export function stripProtoFields<V>(
  metadata: Record<string, V>,
): Record<string, V> {
  let result: Record<string, V> | undefined
  for (const key in metadata) {
    if (key.startsWith('_PROTO_')) {
      if (result === undefined) {
        result = { ...metadata }
      }
      delete result[key]
    }
  }
  return result ?? metadata
}

export function _resetForTesting(): void {
  sink = null
  eventQueue.length = 0
}

class AnalyticsService {
  private static instance: AnalyticsService
  private sessionEvents: Map<string, number> = new Map()

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService()
    }
    return AnalyticsService.instance
  }

  trackEvent(name: string, metadata?: Record<string, unknown>): void {
    logEvent(name, metadata as LogEventMetadata)
    this.sessionEvents.set(name, (this.sessionEvents.get(name) || 0) + 1)
  }

  async trackEventAsync(name: string, metadata?: Record<string, unknown>): Promise<void> {
    await logEventAsync(name, metadata as LogEventMetadata)
    this.sessionEvents.set(name, (this.sessionEvents.get(name) || 0) + 1)
  }

  getSessionEventCount(name: string): number {
    return this.sessionEvents.get(name) || 0
  }

  getAllSessionEvents(): Record<string, number> {
    return Object.fromEntries(this.sessionEvents)
  }

  reset(): void {
    this.sessionEvents.clear()
  }
}

export function getAnalyticsService(): AnalyticsService {
  return AnalyticsService.getInstance()
}
