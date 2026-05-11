/**
 * TIMPS Team Memory Sync Service
 * Team memory synchronization between local and remote storage
 */

import { createHash } from 'crypto'
import { readdir, readFile, stat, writeFile, mkdir } from 'fs/promises'
import { join, relative } from 'path'

export type SyncState = {
  lastKnownChecksum: string | null
  serverChecksums: Map<string, string>
  serverMaxEntries: number | null
}

export type TeamMemorySyncResult = {
  success: boolean
  filesPulled?: number
  filesPushed?: number
  error?: string
  errorType?: 'auth' | 'network' | 'timeout' | 'parse' | 'unknown'
}

export type TeamMemoryEntry = {
  key: string
  content: string
  checksum?: string
}

const MAX_FILE_SIZE_BYTES = 250_000
const TEAM_MEMORY_SYNC_TIMEOUT_MS = 30_000

export function createSyncState(): SyncState {
  return {
    lastKnownChecksum: null,
    serverChecksums: new Map(),
    serverMaxEntries: null,
  }
}

export function hashContent(content: string): string {
  return 'sha256:' + createHash('sha256').update(content, 'utf8').digest('hex')
}

async function readLocalEntries(
  dirPath: string,
): Promise<{ entries: Record<string, string>; skippedCount: number }> {
  const entries: Record<string, string> = {}
  let skippedCount = 0

  async function walkDir(dir: string): Promise<void> {
    try {
      const dirEntries = await readdir(dir, { withFileTypes: true })
      for (const entry of dirEntries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walkDir(fullPath)
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath)
            if (stats.size > MAX_FILE_SIZE_BYTES) {
              skippedCount++
              continue
            }
            const content = await readFile(fullPath, 'utf8')
            const relPath = relative(dirPath, fullPath).replace(/\\/g, '/')
            entries[relPath] = content
          } catch {
            skippedCount++
          }
        }
      }
    } catch {
      // Directory doesn't exist or no access
    }
  }

  await walkDir(dirPath)
  return { entries, skippedCount }
}

async function writeLocalEntries(
  dirPath: string,
  entries: Record<string, string>,
): Promise<number> {
  let writtenCount = 0

  for (const [relPath, content] of Object.entries(entries)) {
    const fullPath = join(dirPath, relPath)
    const parentDir = fullPath.substring(0, fullPath.lastIndexOf('/'))

    try {
      await mkdir(parentDir, { recursive: true })
      await writeFile(fullPath, content, 'utf8')
      writtenCount++
    } catch {
      // Skip files that can't be written
    }
  }

  return writtenCount
}

export interface TeamMemorySyncOptions {
  localPath: string
  remoteEndpoint?: string
  authToken?: string
  onProgress?: (message: string) => void
}

class TeamMemorySyncService {
  private static instance: TeamMemorySyncService
  private syncStates: Map<string, SyncState> = new Map()
  private isSyncing: Map<string, boolean> = new Map()

  private constructor() {}

  static getInstance(): TeamMemorySyncService {
    if (!TeamMemorySyncService.instance) {
      TeamMemorySyncService.instance = new TeamMemorySyncService()
    }
    return TeamMemorySyncService.instance
  }

  getSyncState(projectId: string): SyncState {
    if (!this.syncStates.has(projectId)) {
      this.syncStates.set(projectId, createSyncState())
    }
    return this.syncStates.get(projectId)!
  }

  resetSyncState(projectId: string): void {
    this.syncStates.set(projectId, createSyncState())
  }

  async pull(
    projectId: string,
    options: TeamMemorySyncOptions,
  ): Promise<TeamMemorySyncResult> {
    if (this.isSyncing.get(projectId)) {
      return { success: false, error: 'Sync already in progress' }
    }

    this.isSyncing.set(projectId, true)
    const state = this.getSyncState(projectId)

    try {
      options.onProgress?.(`Pulling team memory for ${projectId}...`)

      const localDir = options.localPath
      await mkdir(localDir, { recursive: true })

      const { entries } = await readLocalEntries(localDir)

      const remoteEntries = await this.fetchRemoteEntries(options)

      if (remoteEntries) {
        const filesWritten = await writeLocalEntries(localDir, remoteEntries)
        this.updateServerChecksums(state, remoteEntries)

        return {
          success: true,
          filesPulled: filesWritten,
        }
      }

      return { success: true, filesPulled: 0 }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
      }
    } finally {
      this.isSyncing.set(projectId, false)
    }
  }

  async push(
    projectId: string,
    options: TeamMemorySyncOptions,
  ): Promise<TeamMemorySyncResult> {
    if (this.isSyncing.get(projectId)) {
      return { success: false, error: 'Sync already in progress' }
    }

    this.isSyncing.set(projectId, true)
    const state = this.getSyncState(projectId)

    try {
      options.onProgress?.(`Pushing team memory for ${projectId}...`)

      const localDir = options.localPath
      const { entries } = await readLocalEntries(localDir)

      const delta: Record<string, string> = {}
      for (const [key, content] of Object.entries(entries)) {
        const localHash = hashContent(content)
        if (state.serverChecksums.get(key) !== localHash) {
          delta[key] = content
        }
      }

      if (Object.keys(delta).length === 0) {
        return { success: true, filesPushed: 0 }
      }

      await this.pushDelta(options, delta)

      for (const [key, content] of Object.entries(delta)) {
        state.serverChecksums.set(key, hashContent(content))
      }

      return {
        success: true,
        filesPushed: Object.keys(delta).length,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
      }
    } finally {
      this.isSyncing.set(projectId, false)
    }
  }

  async sync(
    projectId: string,
    options: TeamMemorySyncOptions,
  ): Promise<TeamMemorySyncResult> {
    const pullResult = await this.pull(projectId, options)
    if (!pullResult.success) {
      return pullResult
    }

    const pushResult = await this.push(projectId, options)
    return {
      success: pushResult.success,
      filesPulled: pullResult.filesPulled,
      filesPushed: pushResult.filesPushed,
      error: pushResult.error,
    }
  }

  private async fetchRemoteEntries(
    _options: TeamMemorySyncOptions,
  ): Promise<Record<string, string> | null> {
    return null
  }

  private async pushDelta(
    _options: TeamMemorySyncOptions,
    _delta: Record<string, string>,
  ): Promise<void> {}

  private updateServerChecksums(
    state: SyncState,
    entries: Record<string, string>,
  ): void {
    for (const [key, content] of Object.entries(entries)) {
      state.serverChecksums.set(key, hashContent(content))
    }
  }
}

export function getTeamMemorySyncService(): TeamMemorySyncService {
  return TeamMemorySyncService.getInstance()
}

export async function pullTeamMemory(
  projectId: string,
  options: TeamMemorySyncOptions,
): Promise<TeamMemorySyncResult> {
  return getTeamMemorySyncService().pull(projectId, options)
}

export async function pushTeamMemory(
  projectId: string,
  options: TeamMemorySyncOptions,
): Promise<TeamMemorySyncResult> {
  return getTeamMemorySyncService().push(projectId, options)
}

export async function syncTeamMemory(
  projectId: string,
  options: TeamMemorySyncOptions,
): Promise<TeamMemorySyncResult> {
  return getTeamMemorySyncService().sync(projectId, options)
}
