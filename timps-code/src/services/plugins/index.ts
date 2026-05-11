/**
 * TIMPS Plugin Service
 * Plugin management with enhanced operations
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type PluginManifest = {
  name: string
  version: string
  description?: string
  author?: string
  commands?: PluginCommand[]
  skills?: PluginSkill[]
  hooks?: PluginHook[]
  mcpServers?: string[]
  dependencies?: string[]
}

export type PluginCommand = {
  name: string
  description: string
  execute: (args: unknown) => Promise<unknown>
}

export type PluginSkill = {
  name: string
  description: string
  instructions: string
}

export type PluginHook = {
  name: string
  trigger: 'pre' | 'post' | 'on'
  handler: (context: unknown) => Promise<unknown>
}

export type LoadedPlugin = {
  name: string
  manifest: PluginManifest
  path: string
  source: string
  enabled: boolean
  isBuiltin: boolean
  commands: PluginCommand[]
  skills: PluginSkill[]
  hooks: PluginHook[]
  mcpServers: string[]
}

export type PluginError = {
  type: 'plugin-not-found' | 'manifest-invalid' | 'load-failed' | 'dependency-missing' | 'generic-error'
  error: string
  pluginId?: string
  dependency?: string
}

export type PluginRepository = {
  url: string
  branch: string
  lastUpdated: string
}

export type PluginLoadResult = {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
  errors: PluginError[]
}

const PLUGIN_DIR = path.join(os.homedir(), '.timps', 'plugins')
const PLUGIN_CONFIG_PATH = path.join(os.homedir(), '.timps', 'plugins.json')

class PluginService extends EventEmitter {
  private static instance: PluginService
  private plugins: Map<string, LoadedPlugin> = new Map()
  private errors: PluginError[] = []
  private repositories: Map<string, PluginRepository> = new Map()
  private pluginDir: string
  private configPath: string

  private constructor() {
    super()
    this.pluginDir = PLUGIN_DIR
    this.configPath = PLUGIN_CONFIG_DIR
    this.ensurePluginDir()
    this.loadPluginConfig()
  }

  static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService()
    }
    return PluginService.instance
  }

  private ensurePluginDir(): void {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true })
    }
  }

  private loadPluginConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
        if (config.repositories) {
          for (const [name, repo] of Object.entries(config.repositories)) {
            this.repositories.set(name, repo as PluginRepository)
          }
        }
      }
    } catch {
      // Use defaults
    }
  }

  private savePluginConfig(): void {
    try {
      const config = {
        repositories: Object.fromEntries(this.repositories),
        enabledPlugins: this.getEnabledPluginNames(),
        disabledPlugins: this.getDisabledPluginNames(),
      }
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch {
      // Best-effort
    }
  }

  private getEnabledPluginNames(): string[] {
    return Array.from(this.plugins.values())
      .filter(p => p.enabled)
      .map(p => p.name)
  }

  private getDisabledPluginNames(): string[] {
    return Array.from(this.plugins.values())
      .filter(p => !p.enabled)
      .map(p => p.name)
  }

  async discoverPlugins(): Promise<LoadedPlugin[]> {
    const discovered: LoadedPlugin[] = []

    if (!fs.existsSync(this.pluginDir)) {
      return discovered
    }

    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.pluginDir, entry.name)
        const manifest = this.loadManifest(pluginPath)
        if (manifest) {
          const plugin: LoadedPlugin = {
            name: manifest.name,
            manifest,
            path: pluginPath,
            source: `local:${entry.name}`,
            enabled: this.isPluginEnabled(manifest.name),
            isBuiltin: false,
            commands: manifest.commands || [],
            skills: manifest.skills || [],
            hooks: manifest.hooks || [],
            mcpServers: manifest.mcpServers || [],
          }
          discovered.push(plugin)
          this.plugins.set(manifest.name, plugin)
        }
      }
    }

    return discovered
  }

  private loadManifest(pluginPath: string): PluginManifest | null {
    const manifestPaths = [
      path.join(pluginPath, 'plugin.json'),
      path.join(pluginPath, 'manifest.json'),
    ]

    for (const manifestPath of manifestPaths) {
      if (fs.existsSync(manifestPath)) {
        try {
          return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        } catch {
          this.errors.push({
            type: 'manifest-invalid',
            error: `Failed to parse manifest: ${manifestPath}`,
          })
        }
      }
    }

    return null
  }

  private isPluginEnabled(name: string): boolean {
    try {
      const configPath = path.join(os.homedir(), '.timps', 'settings.json')
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const disabledPlugins: string[] = config.disabledPlugins || []
        if (disabledPlugins.includes(name)) return false
      }
    } catch {
      // Use default
    }
    return true
  }

  async loadPlugin(name: string): Promise<LoadedPlugin | null> {
    const pluginPath = path.join(this.pluginDir, name)
    if (!fs.existsSync(pluginPath)) {
      this.errors.push({ type: 'plugin-not-found', error: `Plugin not found: ${name}`, pluginId: name })
      return null
    }

    const manifest = this.loadManifest(pluginPath)
    if (!manifest) {
      return null
    }

    const plugin: LoadedPlugin = {
      name: manifest.name,
      manifest,
      path: pluginPath,
      source: `local:${name}`,
      enabled: this.isPluginEnabled(name),
      isBuiltin: false,
      commands: manifest.commands || [],
      skills: manifest.skills || [],
      hooks: manifest.hooks || [],
      mcpServers: manifest.mcpServers || [],
    }

    this.plugins.set(name, plugin)
    this.emit('pluginLoaded', plugin)
    return plugin
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (plugin) {
      this.emit('pluginUnloaded', name)
      this.plugins.delete(name)
    }
  }

  enablePlugin(name: string): void {
    const plugin = this.plugins.get(name)
    if (plugin) {
      plugin.enabled = true
      this.emit('pluginEnabled', name)
    }
  }

  disablePlugin(name: string): void {
    const plugin = this.plugins.get(name)
    if (plugin) {
      plugin.enabled = false
      this.emit('pluginDisabled', name)
    }
  }

  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  getEnabledPlugins(): LoadedPlugin[] {
    return this.getAllPlugins().filter(p => p.enabled)
  }

  getErrors(): PluginError[] {
    return this.errors
  }

  clearErrors(): void {
    this.errors = []
  }

  getLoadResult(): PluginLoadResult {
    return {
      enabled: this.getEnabledPlugins(),
      disabled: this.getAllPlugins().filter(p => !p.enabled),
      errors: this.errors,
    }
  }

  getPluginCommands(): PluginCommand[] {
    return this.getEnabledPlugins()
      .flatMap(p => p.commands || [])
  }

  getPluginSkills(): PluginSkill[] {
    return this.getEnabledPlugins()
      .flatMap(p => p.skills || [])
  }

  getPluginHooks(): PluginHook[] {
    return this.getEnabledPlugins()
      .flatMap(p => p.hooks || [])
  }

  async executeCommand(name: string, args: unknown): Promise<unknown> {
    const commands = this.getPluginCommands()
    const command = commands.find(c => c.name === name)
    if (!command) {
      throw new Error(`Command not found: ${name}`)
    }
    return command.execute(args)
  }

  async installPlugin(name: string, repo: string): Promise<boolean> {
    console.log(`[PluginService] Installing ${name} from ${repo}`)
    return true
  }

  async removePlugin(name: string): Promise<boolean> {
    const pluginPath = path.join(this.pluginDir, name)
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true })
      this.plugins.delete(name)
      return true
    }
    return false
  }

  getRepositories(): Map<string, PluginRepository> {
    return this.repositories
  }
}

export function getPluginService(): PluginService {
  return PluginService.getInstance();
}

export function getPluginManager(): PluginService {
  return PluginService.getInstance();
}

export function getPluginErrorMessage(error: PluginError): string {
  switch (error.type) {
    case 'plugin-not-found':
      return `Plugin not found: ${error.pluginId}`
    case 'manifest-invalid':
      return `Invalid manifest: ${error.error}`
    case 'load-failed':
      return `Failed to load: ${error.error}`
    case 'dependency-missing':
      return `Missing dependency: ${error.dependency}`
    case 'generic-error':
      return error.error
  }
}

const PLUGIN_CONFIG_DIR = path.join(os.homedir(), '.timps', 'plugins.json')
