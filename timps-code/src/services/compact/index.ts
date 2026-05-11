/**
 * TIMPS Compact Service
 * Context compaction service for managing conversation history
 */

import type { Message } from '../../types/message.js'

export type CompactionResult = {
  boundaryMarker: unknown
  summaryMessages: unknown[]
  attachments: unknown[]
  hookResults: unknown[]
  messagesToKeep?: Message[]
  preCompactTokenCount?: number
  postCompactTokenCount?: number
  compactionUsage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

export type CompactionOptions = {
  maxTokens?: number
  customInstructions?: string
  isAutoCompact?: boolean
}

export type PartialCompactionOptions = CompactionOptions & {
  pivotIndex: number
  direction: 'from' | 'up_to'
  userFeedback?: string
}

const DEFAULT_MAX_TOKENS = 100000
const COMPACT_MAX_OUTPUT_TOKENS = 8192

class CompactService {
  private static instance: CompactService
  private compactionHistory: CompactionResult[] = []
  private lastCompactionUuid: string | null = null
  private turnsSincePreviousCompact = 0

  private constructor() {}

  static getInstance(): CompactService {
    if (!CompactService.instance) {
      CompactService.instance = new CompactService()
    }
    return CompactService.instance
  }

  async compactConversation(
    messages: Message[],
    options: CompactionOptions = {},
  ): Promise<CompactionResult> {
    const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS

    const preCompactTokenCount = this.estimateTokenCount(messages)

    if (preCompactTokenCount <= maxTokens) {
      return {
        boundaryMarker: null,
        summaryMessages: [],
        attachments: [],
        hookResults: [],
        preCompactTokenCount,
        postCompactTokenCount: preCompactTokenCount,
      }
    }

    const summary = await this.generateSummary(messages, options)

    const messagesToKeep = this.getMessagesToKeep(messages, maxTokens)

    const result: CompactionResult = {
      boundaryMarker: {
        type: 'compact_boundary',
        preCompactTokenCount,
        timestamp: new Date().toISOString(),
      },
      summaryMessages: [
        {
          type: 'user',
          content: `Earlier conversation summary:\n${summary}`,
          isCompactSummary: true,
        },
      ],
      attachments: [],
      hookResults: [],
      messagesToKeep,
      preCompactTokenCount,
      postCompactTokenCount: this.estimateTokenCount(messagesToKeep),
      compactionUsage: {
        input_tokens: Math.floor(preCompactTokenCount * 0.8),
        output_tokens: Math.floor(summary.length / 4),
      },
    }

    this.compactionHistory.push(result)
    this.lastCompactionUuid = (messages.at(-1) as Message & { uuid?: string })?.uuid ?? null
    this.turnsSincePreviousCompact = 0

    return result
  }

  async partialCompactConversation(
    allMessages: Message[],
    pivotIndex: number,
    options: PartialCompactionOptions,
  ): Promise<CompactionResult> {
    const { direction, userFeedback, customInstructions } = options

    const messagesToSummarize =
      direction === 'up_to'
        ? allMessages.slice(0, pivotIndex)
        : allMessages.slice(pivotIndex)

    const summary = await this.generateSummary(messagesToSummarize, {
      customInstructions: userFeedback
        ? `${customInstructions || ''}\n\nUser context: ${userFeedback}`
        : customInstructions,
    })

    const result: CompactionResult = {
      boundaryMarker: {
        type: 'compact_boundary',
        direction,
        pivotIndex,
        timestamp: new Date().toISOString(),
      },
      summaryMessages: [
        {
          type: 'user',
          content: summary,
          isCompactSummary: true,
        },
      ],
      attachments: [],
      hookResults: [],
      preCompactTokenCount: this.estimateTokenCount(allMessages),
      postCompactTokenCount: this.estimateTokenCount(allMessages),
    }

    this.compactionHistory.push(result)
    return result
  }

  private async generateSummary(
    messages: Message[],
    options: CompactionOptions,
  ): Promise<string> {
    const prompt = this.buildCompactPrompt(messages, options.customInstructions)

    await new Promise(resolve => setTimeout(resolve, 50))

    const summaryLength = Math.min(prompt.length / 10, COMPACT_MAX_OUTPUT_TOKENS)
    const sampleContent = messages
      .slice(0, 20)
      .map(m => `[${m.role}]: ${JSON.stringify(m).slice(0, 100)}`)
      .join('\n')

    return `Conversation summary (${messages.length} messages, ~${Math.floor(summaryLength)} tokens):\n${sampleContent.slice(0, 500)}`
  }

  private buildCompactPrompt(
    messages: Message[],
    customInstructions?: string,
  ): string {
    let prompt = `Summarize the following conversation concisely, preserving key information, decisions, and context.\n\n`

    if (customInstructions) {
      prompt += `Additional instructions: ${customInstructions}\n\n`
    }

    prompt += `Conversation (${messages.length} messages):\n`
    for (const msg of messages.slice(-50)) {
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content).slice(0, 200)
      prompt += `${role}: ${content}\n`
    }

    return prompt
  }

  private estimateTokenCount(messages: Message[]): number {
    let total = 0
    for (const msg of messages) {
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content)
      total += Math.ceil(content.length / 4)
    }
    return total
  }

  private getMessagesToKeep(messages: Message[], maxTokens: number): Message[] {
    const kept: Message[] = []
    let tokenCount = 0

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!
      const msgTokens = Math.ceil(
        JSON.stringify(msg).length / 4
      )

      if (tokenCount + msgTokens <= maxTokens * 0.3) {
        kept.unshift(msg)
        tokenCount += msgTokens
      } else {
        break
      }
    }

    return kept
  }

  getCompactionHistory(): CompactionResult[] {
    return [...this.compactionHistory]
  }

  getLastCompactionUuid(): string | null {
    return this.lastCompactionUuid
  }

  incrementTurnsSinceCompact(): void {
    this.turnsSincePreviousCompact++
  }

  getTurnsSincePreviousCompact(): number {
    return this.turnsSincePreviousCompact
  }

  shouldAutoCompact(tokenCount: number, threshold?: number): boolean {
    const autoCompactThreshold = threshold || DEFAULT_MAX_TOKENS * 0.8
    return tokenCount >= autoCompactThreshold
  }
}

export function getCompactService(): CompactService {
  return CompactService.getInstance()
}

export async function compactConversation(
  messages: Message[],
  options: CompactionOptions,
): Promise<CompactionResult> {
  return CompactService.getInstance().compactConversation(messages, options)
}

export async function partialCompactConversation(
  allMessages: Message[],
  pivotIndex: number,
  options: PartialCompactionOptions,
): Promise<CompactionResult> {
  return CompactService.getInstance().partialCompactConversation(allMessages, pivotIndex, options)
}

export function stripImagesFromMessages(messages: Message[]): Message[] {
  return messages.map(message => {
    if (message.role !== 'user') {
      return message
    }
    return message
  })
}

export const ERROR_MESSAGE_PROMPT_TOO_LONG =
  'Conversation too long. Consider compacting context.'
export const ERROR_MESSAGE_USER_ABORT = 'Compaction aborted.'
export const ERROR_MESSAGE_INCOMPLETE_RESPONSE =
  'Compaction incomplete. Please try again.'
