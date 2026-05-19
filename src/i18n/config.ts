export const locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-US';

export const localeNames: Record<Locale, string> = {
  'en-US': 'English',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'ja-JP': '日本語',
};

// Direction map for future RTL support
export const localeDirection: Record<Locale, 'ltr' | 'rtl'> = {
  'en-US': 'ltr',
  'es-ES': 'ltr',
  'fr-FR': 'ltr',
  'de-DE': 'ltr',
  'ja-JP': 'ltr',
};
