import en from './en.json';
import enCli from './en-cli.json';
import de from './de.json';
import deCli from './de-cli.json';

export type TranslationKeys = typeof en & typeof enCli;
export type Language = 'en' | 'de' | 'es' | 'fr' | 'ja' | 'pt';

export const translations: Record<Language, TranslationKeys> = {
  en: mergeTranslations(en, enCli),
  de: mergeTranslations(de, deCli),
  es: enCli as any,
  fr: enCli as any,
  ja: enCli as any,
  pt: enCli as any,
};

function mergeTranslations(base: any, cli: any): TranslationKeys {
  return { ...base, ...cli };
}

let currentLanguage: Language = 'en';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const translation = translations[currentLanguage][key as keyof TranslationKeys];
  if (!translation) return key;
  if (!params) return translation;

  return Object.entries(params).reduce(
    (str, [param, value]) => str.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value)),
    translation
  );
}

export function getAvailableLanguages(): Language[] {
  return Object.keys(translations) as Language[];
}

export function hasTranslation(key: string): boolean {
  return key in translations[currentLanguage];
}

export function getTranslationsSubset(prefix: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(translations[currentLanguage])) {
    if (key.startsWith(prefix)) {
      result[key] = translations[currentLanguage][key as keyof TranslationKeys];
    }
  }
  return result;
}

export function formatDate(date: Date | number, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const locale = getLocaleForLanguage(currentLanguage);

  return d.toLocaleDateString(locale, {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
  }[style] as Intl.DateTimeFormatOptions);
}

export function formatTime(date: Date | number, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const locale = getLocaleForLanguage(currentLanguage);

  return d.toLocaleTimeString(locale, {
    short: { hour: 'numeric', minute: 'numeric' },
    medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
    long: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
  }[style] as Intl.DateTimeFormatOptions);
}

export function formatDateTime(date: Date | number): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatNumber(num: number, decimals?: number): string {
  const locale = getLocaleForLanguage(currentLanguage);
  return decimals !== undefined
    ? num.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : num.toLocaleString(locale);
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const locale = getLocaleForLanguage(currentLanguage);
  return amount.toLocaleString(locale, { style: 'currency', currency });
}

export function formatPercent(num: number): string {
  const locale = getLocaleForLanguage(currentLanguage);
  return num.toLocaleString(locale, { style: 'percent' });
}

function getLocaleForLanguage(lang: Language): string {
  const localeMap: Record<Language, string> = {
    en: 'en-US',
    de: 'de-DE',
    es: 'es-ES',
    fr: 'fr-FR',
    ja: 'ja-JP',
    pt: 'pt-BR',
  };
  return localeMap[lang];
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
  zero?: string
): string {
  if (count === 0 && zero) return zero;
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

export function formatList(items: string[], conjunction: string = 'and'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;

  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return `${rest.join(', ')}, ${conjunction} ${last}`;
}