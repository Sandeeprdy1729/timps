import { Plugin, PluginManifest, PluginCapabilities } from './types';

export class DateTimePlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/datetime',
    name: 'Date & Time',
    version: '1.0.0',
    description: 'Date, time, and timezone utilities',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['date', 'time', 'datetime', 'timezone'],
  };

  public capabilities: PluginCapabilities = {};

  now(): Date {
    return new Date();
  }

  parse(dateStr: string, format?: string): DateTime {
    return new DateTime(new Date(dateStr));
  }

  format(date: Date, formatStr: string): string {
    const d = new Date(date);
    return formatStr
      .replace('YYYY', d.getFullYear().toString())
      .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', d.getDate().toString().padStart(2, '0'))
      .replace('HH', d.getHours().toString().padStart(2, '0'))
      .replace('mm', d.getMinutes().toString().padStart(2, '0'))
      .replace('ss', d.getSeconds().toString().padStart(2, '0'));
  }

  add(date: Date, amount: number, unit: TimeUnit): Date {
    const result = new Date(date);

    switch (unit) {
      case 'years':
        result.setFullYear(result.getFullYear() + amount);
        break;
      case 'months':
        result.setMonth(result.getMonth() + amount);
        break;
      case 'weeks':
        result.setDate(result.getDate() + amount * 7);
        break;
      case 'days':
        result.setDate(result.getDate() + amount);
        break;
      case 'hours':
        result.setHours(result.getHours() + amount);
        break;
      case 'minutes':
        result.setMinutes(result.getMinutes() + amount);
        break;
      case 'seconds':
        result.setSeconds(result.getSeconds() + amount);
        break;
      case 'milliseconds':
        result.setMilliseconds(result.getMilliseconds() + amount);
        break;
    }

    return result;
  }

  diff(date1: Date, date2: Date, unit: TimeUnit = 'milliseconds'): number {
    const diff = date2.getTime() - date1.getTime();

    switch (unit) {
      case 'years':
        return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
      case 'months':
        return Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
      case 'weeks':
        return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
      case 'days':
        return Math.floor(diff / (24 * 60 * 60 * 1000));
      case 'hours':
        return Math.floor(diff / (60 * 60 * 1000));
      case 'minutes':
        return Math.floor(diff / (60 * 1000));
      case 'seconds':
        return Math.floor(diff / 1000);
      case 'milliseconds':
        return diff;
    }
  }

  startOf(date: Date, unit: TimeUnit): Date {
    const result = new Date(date);

    switch (unit) {
      case 'year':
        result.setMonth(0, 1);
        result.setHours(0, 0, 0, 0);
        break;
      case 'month':
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const day = result.getDay();
        result.setDate(result.getDate() - day);
        result.setHours(0, 0, 0, 0);
        break;
      case 'day':
        result.setHours(0, 0, 0, 0);
        break;
      case 'hour':
        result.setMinutes(0, 0, 0);
        break;
      case 'minute':
        result.setSeconds(0, 0);
        break;
    }

    return result;
  }

  endOf(date: Date, unit: TimeUnit): Date {
    const result = new Date(date);

    switch (unit) {
      case 'year':
        result.setMonth(11, 31);
        result.setHours(23, 59, 59, 999);
        break;
      case 'month':
        result.setMonth(result.getMonth() + 1, 0);
        result.setHours(23, 59, 59, 999);
        break;
      case 'week':
        result.setDate(result.getDate() + (6 - result.getDay()));
        result.setHours(23, 59, 59, 999);
        break;
      case 'day':
        result.setHours(23, 59, 59, 999);
        break;
      case 'hour':
        result.setMinutes(59, 59, 999);
        break;
    }

    return result;
  }

  isSame(date1: Date, date2: Date, unit: TimeUnit = 'day'): boolean {
    return this.startOf(date1, unit).getTime() === this.startOf(date2, unit).getTime();
  }

  isAfter(date1: Date, date2: Date): boolean {
    return date1.getTime() > date2.getTime();
  }

  isBefore(date1: Date, date2: Date): boolean {
    return date1.getTime() < date2.getTime();
  }

  isBetween(date: Date, start: Date, end: Date): boolean {
    const t = date.getTime();
    return t > start.getTime() && t < end.getTime();
  }

  isLeapYear(date: Date): boolean {
    const year = date.getFullYear();
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  daysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  quarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  weekday(date: Date): number {
    return date.getDay() || 7;
  }

  toUnix(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  fromUnix(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  toIso(date: Date): string {
    return date.toISOString();
  }

  parseIso(iso: string): Date {
    return new Date(iso);
  }
}

export class DateTime {
  private date: Date;

  constructor(date: Date) {
    this.date = date;
  }

  getDate(): Date {
    return this.date;
  }

  add(amount: number, unit: TimeUnit): DateTime {
    return new DateTime(
      new DateTimePlugin().add(this.date, amount, unit)
    );
  }

  diff(other: DateTime, unit: TimeUnit = 'milliseconds'): number {
    return new DateTimePlugin().diff(this.date, other.date, unit);
  }

  format(format: string): string {
    return new DateTimePlugin().format(this.date, format);
  }

  isSame(other: DateTime, unit: TimeUnit = 'day'): boolean {
    return new DateTimePlugin().isSame(this.date, other.date, unit);
  }

  isAfter(other: DateTime): boolean {
    return new DateTimePlugin().isAfter(this.date, other.date);
  }

  isBefore(other: DateTime): boolean {
    return new DateTimePlugin().isBefore(this.date, other.date);
  }

  valueOf(): number {
    return this.date.getTime();
  }

  toString(): string {
    return this.date.toISOString();
  }
}

export type TimeUnit =
  | 'years'
  | 'months'
  | 'weeks'
  | 'days'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'milliseconds'
  | 'year'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

export class DurationPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/duration',
    name: 'Duration',
    version: '1.0.0',
    description: 'Parse and format durations',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['duration', 'time', 'interval'],
  };

  public capabilities: PluginCapabilities = {};

  create(duration: DurationInput): Duration {
    if (typeof duration === 'number') {
      return new Duration(duration);
    }
    return new Duration(this.parse(duration));
  }

  parse(duration: string): number {
    const regex = /(\d+)(y|mo|w|d|h|m|s|ms)/;
    const match = duration.match(regex);

    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    return value * this.getMultiplier(unit);
  }

  format(milliseconds: number): string {
    const units: Array<{ unit: string; ms: number }> = [
      { unit: 'y', ms: 31557600000 },
      { unit: 'mo', ms: 2629800000 },
      { unit: 'w', ms: 604800000 },
      { unit: 'd', ms: 86400000 },
      { unit: 'h', ms: 3600000 },
      { unit: 'm', ms: 60000 },
      { unit: 's', ms: 1000 },
      { unit: 'ms', ms: 1 },
    ];

    let result = '';
    let remaining = milliseconds;

    for (const { unit, ms } of units) {
      if (remaining >= ms || (result === '' && ms === 1)) {
        const count = Math.floor(remaining / ms);
        if (count > 0 || (ms === 1 && result === '')) {
          result += count + unit;
          remaining %= ms;
        }
      }
    }

    return result;
  }

  private getMultiplier(unit: string): number {
    const multipliers: Record<string, number> = {
      y: 31557600000,
      mo: 2629800000,
      w: 604800000,
      d: 86400000,
      h: 3600000,
      m: 60000,
      s: 1000,
      ms: 1,
    };
    return multipliers[unit] || 0;
  }
}

export class Duration {
  constructor(private milliseconds: number) {}

  milliseconds(): number {
    return this.milliseconds;
  }

  seconds(): number {
    return Math.floor(this.milliseconds / 1000);
  }

  minutes(): number {
    return Math.floor(this.milliseconds / 60000);
  }

  hours(): number {
    return Math.floor(this.milliseconds / 3600000);
  }

  days(): number {
    return Math.floor(this.milliseconds / 86400000);
  }

  weeks(): number {
    return Math.floor(this.milliseconds / 604800000);
  }

  months(): number {
    return Math.floor(this.milliseconds / 2629800000);
  }

  years(): number {
    return Math.floor(this.milliseconds / 31557600000);
  }

  add(other: Duration): Duration {
    return new Duration(this.milliseconds + other.milliseconds);
  }

  subtract(other: Duration): Duration {
    return new Duration(this.milliseconds - other.milliseconds);
  }

  multiply(factor: number): Duration {
    return new Duration(this.milliseconds * factor);
  }

  divide(factor: number): Duration {
    return new Duration(this.milliseconds / factor);
  }

  toString(): string {
    return new DurationPlugin().format(this.milliseconds);
  }

  valueOf(): number {
    return this.milliseconds;
  }
}

export type DurationInput = string | number;

export class CalendarPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/calendar',
    name: 'Calendar',
    version: '1.0.0',
    description: 'Calendar grid and events',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['calendar', 'schedule', 'events'],
  };

  public capabilities: PluginCapabilities = {};

  createEvent(options: CalendarEventOptions): CalendarEvent {
    return new CalendarEvent(options);
  }

  getMonthGrid(year: number, month: number): CalendarDay[][] {
    const weeks: CalendarDay[][] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let currentWeek: CalendarDay[] = [];

    const startPadding = firstDay.getDay();
    for (let i = 0; i < startPadding; i++) {
      currentWeek.push({
        date: new Date(year, month, 0),
        day: 0,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      currentWeek.push({
        date,
        day,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        events: []
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    const endPadding = currentWeek.length;
    if (endPadding > 0) {
      for (let i = endPadding; i < 7; i++) {
        currentWeek.push({
          date: new Date(year, month + 1, i - endPadding + 1),
          day: i - endPadding + 1,
          isCurrentMonth: false,
          isToday: false,
          events: []
        });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  getWeekGrid(date: Date): CalendarDay[] {
    const days: CalendarDay[] = [];
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);

      days.push({
        date: dayDate,
        day: dayDate.getDate(),
        isCurrentMonth: true,
        isToday: this.isToday(dayDate),
        events: []
      });
    }

    return days;
  }

  findConflicts(events: CalendarEvent[]): Array<[CalendarEvent, CalendarEvent]> {
    const conflicts: Array<[CalendarEvent, CalendarEvent]> = [];

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.eventsOverlap(events[i], events[j])) {
          conflicts.push([events[i], events[j]]);
        }
      }
    }

    return conflicts;
  }

  private eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return (
      event1.start < event2.end &&
      event1.end > event2.start
    );
  }

  getNextEvents(events: CalendarEvent[], count: number): CalendarEvent[] {
    const now = new Date();
    return events
      .filter(e => e.start > now)
      .sort((a, b) => a.start - b.start)
      .slice(0, count);
  }
}

export class CalendarEvent {
  constructor(public options: CalendarEventOptions) {}

  start = new Date(this.options.start);
  end = new Date(this.options.end);
  title = this.options.title;
  description = this.options.description;
  location = this.options.location;
  attendees = this.options.attendees || [];
  reminders = this.options.reminders || [];

  overlaps(other: CalendarEvent): boolean {
    return this.start < other.end && this.end > other.start;
  }

  duration(): number {
    return this.end.getTime() - this.start.getTime();
  }

  isAllDay(): boolean {
    return this.options.allDay || false;
  }
}

export interface CalendarEventOptions {
  title: string;
  start: Date | string;
  end: Date | string;
  description?: string;
  location?: string;
  attendees?: string[];
  reminders?: number[];
  allDay?: boolean;
}

export interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export class I18nPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/i18n',
    name: 'Internationalization',
    version: '1.0.0',
    description: 'Multi-language support',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['i18n', 'locale', 'translation', 'language'],
  };

  public capabilities: PluginCapabilities = {};

  private translations: Record<string, Record<string, string>> = {};
  private currentLocale = 'en';

  addTranslation(locale: string, translations: Record<string, string>): void {
    this.translations[locale] = translations;
  }

  setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  getLocale(): string {
    return this.currentLocale;
  }

  t(key: string, params?: Record<string, string>): string {
    let translation = this.translations[this.currentLocale]?.[key] ||
                   this.translations['en']?.[key] ||
                   key;

    if (params) {
      for (const [param, value] of Object.entries(params)) {
        translation = translation.replace(new RegExp(`\\{${Param}\\}`, 'g'), value);
      }
    }

    return translation;
  }

  getAvailableLocales(): string[] {
    return Object.keys(this.translations);
  }

  hasTranslation(key: string, locale?: string): boolean {
    const loc = locale || this.currentLocale;
    return key in (this.translations[loc] || {});
  }

  plural(key: string, count: number, forms?: string[]): string {
    const pluralForms = forms || ['other'];
    const index = this.getPluralIndex(count, pluralForms.length);
    const translated = this.t(key);

    if (translated.includes('|')) {
      const variants = translated.split('|');
      return variants[index] || variants[0];
    }

    return translated;
  }

  private getPluralIndex(count: number, forms: number): number {
    if (count === 1) return 0;
    if (forms >= 4 && (count === 0 || count === 1)) return 0;
    if (forms >= 4 && count % 10 === 1 && count % 100 !== 11) return 0;
    if (forms >= 4 && count % 10 === 2 && count % 100 !== 12) return 1;
    if (forms >= 4 && count % 10 === 3 && count % 100 !== 13) return 2;
    return forms - 1;
  }

  formatNumber(num: number, locale?: string): string {
    const loc = locale || this.currentLocale;
    return new Intl.NumberFormat(loc).format(num);
  }

  formatCurrency(amount: number, currency: string, locale?: string): string {
    const loc = locale || this.currentLocale;
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency
    }).format(amount);
  }

  formatDate(date: Date, locale?: string): string {
    const loc = locale || this.currentLocale;
    return new Intl.DateTimeFormat(loc).format(date);
  }

  formatRelative(date: Date, locale?: string): string {
    const loc = locale || this.currentLocale;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return this.t('time.secondsAgo', { count: String(seconds) });
    if (minutes < 60) return this.t('time.minutesAgo', { count: String(minutes) });
    if (hours < 24) return this.t('time.hoursAgo', { count: String(hours) });
    return this.t('time.daysAgo', { count: String(days) });
  }
}

export class NumberFormatPlugin implements Plugin {
  public manifest: PluginManifest = {
    id: '@timps/number-format',
    name: 'Number Format',
    version: '1.0.0',
    description: 'Number formatting and parsing',
    author: 'TIMPS Team',
    main: 'index.js',
    keywords: ['number', 'format', 'currency', 'percent'],
  };

  public capabilities: PluginCapabilities = {};

  format(num: number, options: NumberFormatOptions = {}): string {
    return new Intl.NumberFormat(options.locale, {
      style: options.style || 'decimal',
      minimumFractionDigits: options.minDigits,
      maximumFractionDigits: options.maxDigits,
      useGrouping: options.useGrouping
    }).format(num);
  }

  parse(value: string): number | null {
    const cleaned = value.replace(new RegExp(`[^0-9${ this.getDecimalSeparator() }-]`, 'g'), '');
    return parseFloat(cleaned.replace(this.getDecimalSeparator(), '.'));
  }

  currency(amount: number, currency: string, locale?: string): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency
    }).format(amount);
  }

  percent(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
      style: 'percent'
    }).format(value);
  }

  ordinal(num: number, locale?: string): string {
    return new Intl.RelativeTimeFormat(locale, { style: 'narrow' }).format(num, 'year');
  }

  range(start: number, end: number, options: NumberFormatOptions = {}): string {
    return `${this.format(start, options)} - ${this.format(end, options)}`;
  }

  compact(num: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
      notation: 'compact'
    }).format(num);
  }

  scientific(num: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
      notation: 'scientific'
    }).format(num);
  }

  private getDecimalSeparator(): string {
    return (1.1).toString().slice(1, 2);
  }
}

export interface NumberFormatOptions {
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent' | 'unit';
  minDigits?: number;
  maxDigits?: number;
  useGrouping?: boolean;
}