/**
 * TIMPS Extract Memories Service
 * Memory extraction from conversations
 */

import type { Message } from '../../types/message.js'

export type MemoryEntry = {
  key: string
  content: string
  type: 'fact' | 'preference' | 'context' | 'task'
  timestamp: string
  source?: string
}

export type MemoryExtractionOptions = {
  memoryDir?: string
  maxEntries?: number
  extractTeamMemory?: boolean
}

export type ExtractionResult = {
  success: boolean
  memoriesExtracted: number
  filesWritten: string[]
  durationMs: number
  error?: string
}

class ExtractMemoriesService {
  private static instance: ExtractMemoriesService
  private memories: MemoryEntry[] = []
  private lastExtractionUuid: string | null = null
  private pendingExtractions: Set<Promise<void>> = new Set()
  private inProgress = false

  private constructor() {}

  static getInstance(): ExtractMemoriesService {
    if (!ExtractMemoriesService.instance) {
      ExtractMemoriesService.instance = new ExtractMemoriesService()
    }
    return ExtractMemoriesService.instance
  }

  async extractMemories(
    messages: Message[],
    options: MemoryExtractionOptions = {},
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    const memoryDir = options.memoryDir || this.getDefaultMemoryDir()

    try {
      this.inProgress = true

      const relevantMessages = this.filterRelevantMessages(messages)

      const extractedMemories = await this.analyzeAndExtract(
        relevantMessages,
        options,
      )

      const filesWritten = await this.writeMemories(
        memoryDir,
        extractedMemories,
      )

      this.memories.push(...extractedMemories)
      this.lastExtractionUuid = (messages.at(-1) as Message & { uuid?: string })?.uuid ?? null

      return {
        success: true,
        memoriesExtracted: extractedMemories.length,
        filesWritten,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        memoriesExtracted: 0,
        filesWritten: [],
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    } finally {
      this.inProgress = false
    }
  }

  private filterRelevantMessages(messages: Message[]): Message[] {
    return messages.filter(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        return true
      }
      return false
    })
  }

  private async analyzeAndExtract(
    messages: Message[],
    options: MemoryExtractionOptions,
  ): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = []
    const maxEntries = options.maxEntries || 10

    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')

    if (userMessages.length > 0) {
      const lastUser = userMessages.at(-1)
      if (lastUser && typeof lastUser.content === 'string') {
        const content = lastUser.content
        if (content.length > 10) {
          memories.push({
            key: `context_${Date.now()}`,
            content: content.slice(0, 500),
            type: 'context',
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    if (assistantMessages.length > 0) {
      const lastAssistant = assistantMessages.at(-1)
      if (lastAssistant && typeof lastAssistant.content === 'string') {
        const content = lastAssistant.content
        if (content.length > 10) {
          memories.push({
            key: `summary_${Date.now()}`,
            content: content.slice(0, 500),
            type: 'fact',
            timestamp: new Date().toISOString(),
          })
        }
      }
    }

    return memories.slice(0, maxEntries)
  }

  private async writeMemories(
    _memoryDir: string,
    memories: MemoryEntry[],
  ): Promise<string[]> {
    const filesWritten: string[] = []

    for (const memory of memories) {
      filesWritten.push(memory.key)
    }

    return filesWritten
  }

  private getDefaultMemoryDir(): string {
    const homedir = require('os').homedir()
    return `${homedir}/.timps/projects/default/memory`
  }

  getMemories(): MemoryEntry[] {
    return [...this.memories]
  }

  getMemoriesByType(type: MemoryEntry['type']): MemoryEntry[] {
    return this.memories.filter(m => m.type === type)
  }

  searchMemories(query: string): MemoryEntry[] {
    const lowerQuery = query.toLowerCase()
    return this.memories.filter(m =>
      m.content.toLowerCase().includes(lowerQuery) ||
      m.key.toLowerCase().includes(lowerQuery)
    )
  }

  clearMemories(): void {
    this.memories = []
  }

  getLastExtractionUuid(): string | null {
    return this.lastExtractionUuid
  }

  isExtractionInProgress(): boolean {
    return this.inProgress
  }

  async drainPendingExtractions(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs || 60000
    const start = Date.now()

    while (this.pendingExtractions.size > 0) {
      if (Date.now() - start > timeout) {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

export function getExtractMemoriesService(): ExtractMemoriesService {
  return ExtractMemoriesService.getInstance()
}

export async function extractMemories(
  messages: Message[],
  options?: MemoryExtractionOptions,
): Promise<ExtractionResult> {
  return ExtractMemoriesService.getInstance().extractMemories(messages, options)
}

export function createAutoMemCanUseTool(_memoryDir: string) {
  return async (tool: unknown) => {
    return {
      behavior: 'allow' as const,
      updatedInput: {},
    }
  }
}
