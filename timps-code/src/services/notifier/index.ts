/**
 * TIMPS Notifier Service
 * Notification service for terminal and system notifications
 */

export type NotificationOptions = {
  message: string
  title?: string
  notificationType: string
  priority?: 'low' | 'normal' | 'high' | 'immediate'
  color?: 'info' | 'warning' | 'error' | 'success'
}

export type NotificationChannel =
  | 'auto'
  | 'terminal_bell'
  | 'native'
  | 'none'

type NotificationMethod = 'iterm2' | 'terminal_bell' | 'native' | 'none' | 'disabled'

interface TerminalNotifier {
  notify(message: NotificationOptions): void
  notifyBell(): void
}

class NotifierService {
  private static instance: NotifierService
  private channel: NotificationChannel = 'auto'
  private terminal: TerminalNotifier | null = null
  private history: NotificationOptions[] = []
  private maxHistory = 50

  private constructor() {}

  static getInstance(): NotifierService {
    if (!NotifierService.instance) {
      NotifierService.instance = new NotifierService()
    }
    return NotifierService.instance
  }

  setChannel(channel: NotificationChannel): void {
    this.channel = channel
  }

  setTerminalNotifier(terminal: TerminalNotifier): void {
    this.terminal = terminal
  }

  async send(options: NotificationOptions): Promise<NotificationMethod> {
    this.addToHistory(options)

    const method = await this.sendToChannel(options)

    return method
  }

  private async sendToChannel(
    options: NotificationOptions,
  ): Promise<NotificationMethod> {
    const title = options.title || 'TIMPS'

    if (this.channel === 'none') {
      return 'disabled'
    }

    if (this.channel === 'terminal_bell') {
      this.terminal?.notifyBell()
      return 'terminal_bell'
    }

    if (this.channel === 'native') {
      return this.sendNative(options)
    }

    return this.sendAuto(options)
  }

  private sendAuto(options: NotificationOptions): NotificationMethod {
    if (this.terminal) {
      this.terminal.notify(options)
      return 'iterm2'
    }

    return this.sendNative(options)
  }

  private sendNative(options: NotificationOptions): NotificationMethod {
    try {
      if (process.platform === 'darwin') {
        const { execSync } = require('child_process')
        const title = options.title || 'TIMPS'
        const message = options.message.replace(/"/g, '\\"')
        execSync(
          `osascript -e 'display notification "${message}" with title "${title}"'`,
          { stdio: 'ignore' },
        )
        return 'native'
      }
    } catch {
      // Fallback to no notification
    }
    return 'none'
  }

  notify(options: NotificationOptions): void {
    this.addToHistory(options)
    if (this.terminal) {
      this.terminal.notify(options)
    }
  }

  notifyBell(): void {
    this.terminal?.notifyBell()
  }

  private addToHistory(options: NotificationOptions): void {
    this.history.push(options)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }

  getHistory(): NotificationOptions[] {
    return [...this.history]
  }

  getChannel(): NotificationChannel {
    return this.channel
  }

  clearHistory(): void {
    this.history = []
  }
}

export function getNotifierService(): NotifierService {
  return NotifierService.getInstance()
}

export function notify(options: NotificationOptions): void {
  getNotifierService().notify(options)
}

export async function sendNotification(
  options: NotificationOptions,
): Promise<NotificationMethod> {
  return getNotifierService().send(options)
}

export function notifySuccess(message: string, title?: string): void {
  notify({
    message,
    title: title || 'Success',
    notificationType: 'success',
    priority: 'normal',
    color: 'success',
  })
}

export function notifyError(message: string, title?: string): void {
  notify({
    message,
    title: title || 'Error',
    notificationType: 'error',
    priority: 'immediate',
    color: 'error',
  })
}

export function notifyWarning(message: string, title?: string): void {
  notify({
    message,
    title: title || 'Warning',
    notificationType: 'warning',
    priority: 'high',
    color: 'warning',
  })
}

export function notifyInfo(message: string, title?: string): void {
  notify({
    message,
    title: title || 'Info',
    notificationType: 'info',
    priority: 'normal',
    color: 'info',
  })
}
