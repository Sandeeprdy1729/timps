export interface DateTimeFormatOptions {
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  timeZoneName?: 'short' | 'long';
  weekday?: 'long' | 'short' | 'narrow';
}

export function formatDate(date: Date | number | string, options?: DateTimeFormatOptions, locale = 'en-US'): string {
  const d = new Date(date);
  return d.toLocaleDateString(locale, options as Intl.DateTimeFormatOptions);
}

export function formatTime(date: Date | number | string, options?: DateTimeFormatOptions, locale = 'en-US'): string {
  const d = new Date(date);
  return d.toLocaleTimeString(locale, options as Intl.DateTimeFormatOptions);
}

export function formatDateTime(date: Date | number | string, options?: DateTimeFormatOptions, locale = 'en-US'): string {
  const d = new Date(date);
  return d.toLocaleString(locale, options as Intl.DateTimeFormatOptions);
}

export function formatRelative(date: Date | number | string, locale = 'en-US'): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (seconds < 60) return rtf.format(-seconds, 'second');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  if (days < 7) return rtf.format(-days, 'day');
  if (weeks < 4) return rtf.format(-weeks, 'week');
  if (months < 12) return rtf.format(-months, 'month');
  return rtf.format(-years, 'year');
}

export function parseDate(dateString: string): Date | null {
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isToday(date: Date | number | string): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isYesterday(date: Date | number | string): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

export function isTomorrow(date: Date | number | string): boolean {
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

export function startOfDay(date: Date | number | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date | number | string): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date | number | string, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return startOfDay(d);
}

export function endOfWeek(date: Date | number | string, weekStartsOn: 0 | 1 = 1): Date {
  return endOfDay(addDays(startOfWeek(date, weekStartsOn), 6);
}

export function startOfMonth(date: Date | number | string): Date {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

export function endOfMonth(date: Date | number | string): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  return endOfDay(d);
}

export function startOfYear(date: Date | number | string): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  return startOfDay(d);
}

export function endOfYear(date: Date | number | string): Date {
  const d = new Date(date);
  d.setMonth(11, 31);
  return endOfDay(d);
}

export function addDays(date: Date | number | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date | number | string, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addYears(date: Date | number | string, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function addHours(date: Date | number | string, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export function addMinutes(date: Date | number | string, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function differenceInDays(date1: Date | number | string, date2: Date | number | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function differenceInHours(date1: Date | number | string, date2: Date | number | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

export function differenceInMinutes(date1: Date | number | string, date2: Date | number | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60));
}

export function differenceInSeconds(date1: Date | number | string, date2: Date | number | string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / 1000);
}

export function isBefore(date1: Date | number, date2: Date | number): boolean {
  return new Date(date1).getTime() < new Date(date2).getTime();
}

export function isAfter(date1: Date | number, date2: Date | number): boolean {
  return new Date(date1).getTime() > new Date(date2).getTime();
}

export function isSameDay(date1: Date | number | string, date2: Date | number | string): boolean {
  return new Date(date1).toDateString() === new Date(date2).toDateString();
}

export function isSameMonth(date1: Date | number | string, date2: Date | number | string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
}

export function isSameYear(date1: Date | number | string, date2: Date | number | string): boolean {
  return new Date(date1).getFullYear() === new Date(date2).getFullYear();
}

export function getDaysInMonth(date: Date | number | string): number {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function getWeek(date: Date | number | string): number {
  const d = new Date(date);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getQuarter(date: Date | number | string): number {
  return Math.floor(new Date(date).getMonth() / 3) + 1;
}

export function toISOString(date: Date | number | string): string {
  return new Date(date).toISOString();
}

export function toUTCString(date: Date | number | string): string {
  return new Date(date).toUTCString();
}

export function unixTimestamp(date: Date | number | string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

export function min(...dates: (Date | number | string)[]): Date {
  return new Date(Math.min(...dates.map(d => new Date(d).getTime()));
}

export function max(...dates: (Date | number | string)[]): Date {
  return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
}

export function eachDayOfInterval(start: Date | number | string, end: Date | number | string): Date[] {
  const dates: Date[] = [];
  let current = startOfDay(start);
  const endDate = startOfDay(end);
  
  while (isBefore(current, endDate) || isSameDay(current, endDate)) {
    dates.push(new Date(current));
    current = addDays(current, 1);
  }
  
  return dates;
}

export function eachMonthOfInterval(start: Date | number | string, end: Date | number | string): Date[] {
  const months: Date[] = [];
  let current = startOfMonth(start);
  const endDate = startOfMonth(end);
  
  while (isBefore(current, endDate) || isSameMonth(current, endDate)) {
    months.push(new Date(current));
    current = addMonths(current, 1);
  }
  
  return months;
}