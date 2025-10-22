/**
 * Конфигурация стран для мониторинга трендов YouTube
 * Список включает 19 стран с высоким уровнем жизни
 */

export const COUNTRIES = [
  {
    name: 'США',
    nameEn: 'United States',
    code: 'US',
    flag: '🇺🇸',
    language: 'en',
    timezone: 'America/New_York'
  },
  {
    name: 'Канада',
    nameEn: 'Canada',
    code: 'CA',
    flag: '🇨🇦',
    language: 'en',
    timezone: 'America/Toronto'
  },
  {
    name: 'Финляндия',
    nameEn: 'Finland',
    code: 'FI',
    flag: '🇫🇮',
    language: 'fi',
    timezone: 'Europe/Helsinki'
  },
  {
    name: 'Швеция',
    nameEn: 'Sweden',
    code: 'SE',
    flag: '🇸🇪',
    language: 'sv',
    timezone: 'Europe/Stockholm'
  },
  {
    name: 'Швейцария',
    nameEn: 'Switzerland',
    code: 'CH',
    flag: '🇨🇭',
    language: 'de',
    timezone: 'Europe/Zurich'
  },
  {
    name: 'Норвегия',
    nameEn: 'Norway',
    code: 'NO',
    flag: '🇳🇴',
    language: 'no',
    timezone: 'Europe/Oslo'
  },
  {
    name: 'Германия',
    nameEn: 'Germany',
    code: 'DE',
    flag: '🇩🇪',
    language: 'de',
    timezone: 'Europe/Berlin'
  },
  {
    name: 'Англия',
    nameEn: 'United Kingdom',
    code: 'GB',
    flag: '🇬🇧',
    language: 'en',
    timezone: 'Europe/London'
  },
  {
    name: 'Франция',
    nameEn: 'France',
    code: 'FR',
    flag: '🇫🇷',
    language: 'fr',
    timezone: 'Europe/Paris'
  },
  {
    name: 'Бельгия',
    nameEn: 'Belgium',
    code: 'BE',
    flag: '🇧🇪',
    language: 'nl',
    timezone: 'Europe/Brussels'
  },
  {
    name: 'Нидерланды',
    nameEn: 'Netherlands',
    code: 'NL',
    flag: '🇳🇱',
    language: 'nl',
    timezone: 'Europe/Amsterdam'
  },
  {
    name: 'Ирландия',
    nameEn: 'Ireland',
    code: 'IE',
    flag: '🇮🇪',
    language: 'en',
    timezone: 'Europe/Dublin'
  },
  {
    name: 'Дания',
    nameEn: 'Denmark',
    code: 'DK',
    flag: '🇩🇰',
    language: 'da',
    timezone: 'Europe/Copenhagen'
  },
  {
    name: 'Австрия',
    nameEn: 'Austria',
    code: 'AT',
    flag: '🇦🇹',
    language: 'de',
    timezone: 'Europe/Vienna'
  },
  {
    name: 'Австралия',
    nameEn: 'Australia',
    code: 'AU',
    flag: '🇦🇺',
    language: 'en',
    timezone: 'Australia/Sydney'
  },
  {
    name: 'Новая Зеландия',
    nameEn: 'New Zealand',
    code: 'NZ',
    flag: '🇳🇿',
    language: 'en',
    timezone: 'Pacific/Auckland'
  },
  {
    name: 'Израиль',
    nameEn: 'Israel',
    code: 'IL',
    flag: '🇮🇱',
    language: 'he',
    timezone: 'Asia/Jerusalem'
  },
  {
    name: 'Сингапур',
    nameEn: 'Singapore',
    code: 'SG',
    flag: '🇸🇬',
    language: 'en',
    timezone: 'Asia/Singapore'
  },
  {
    name: 'Исландия',
    nameEn: 'Iceland',
    code: 'IS',
    flag: '🇮🇸',
    language: 'is',
    timezone: 'Atlantic/Reykjavik'
  }
];

/**
 * Получить страну по коду
 */
export function getCountryByCode(code) {
  return COUNTRIES.find(country => country.code === code);
}

/**
 * Получить все коды стран
 */
export function getAllCountryCodes() {
  return COUNTRIES.map(country => country.code);
}

/**
 * Получить страны по языку
 */
export function getCountriesByLanguage(language) {
  return COUNTRIES.filter(country => country.language === language);
}

export default COUNTRIES;
