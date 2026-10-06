import { COUNTRIES, Country } from '../data/countries';

export async function detectUserCountry(): Promise<Country> {
  // 1. Try public IP geolocation service with 3-second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch('https://ipapi.co/json/', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.country_name) {
        const match = COUNTRIES.find(
          c => c.name.toLowerCase() === data.country_name.toLowerCase() ||
               c.code.toUpperCase() === (data.country_code || '').toUpperCase()
        );
        if (match && match.code !== 'ALL') {
          return match;
        }
      }
    }
  } catch {
    // Silently proceed to secondary fallback
  }

  // 2. Secondary fallback: api.country.is
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://api.country.is/', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.country) {
        const match = COUNTRIES.find(c => c.code.toUpperCase() === data.country.toUpperCase());
        if (match && match.code !== 'ALL') {
          return match;
        }
      }
    }
  } catch {
    // Silently proceed to browser locale
  }

  // 3. Fallback based on browser language / locale
  const lang = (navigator.language || navigator.languages?.[0] || 'en-US').toUpperCase();
  if (lang.includes('JO')) return COUNTRIES.find(c => c.code === 'JO')!;
  if (lang.includes('GB')) return COUNTRIES.find(c => c.code === 'GB')!;
  if (lang.includes('CA')) return COUNTRIES.find(c => c.code === 'CA')!;
  if (lang.includes('DE')) return COUNTRIES.find(c => c.code === 'DE')!;
  if (lang.includes('FR')) return COUNTRIES.find(c => c.code === 'FR')!;
  if (lang.includes('TR')) return COUNTRIES.find(c => c.code === 'TR')!;
  if (lang.includes('SA')) return COUNTRIES.find(c => c.code === 'SA')!;
  if (lang.includes('AE')) return COUNTRIES.find(c => c.code === 'AE')!;
  if (lang.includes('EG')) return COUNTRIES.find(c => c.code === 'EG')!;
  if (lang.includes('ES')) return COUNTRIES.find(c => c.code === 'ES')!;
  if (lang.includes('IT')) return COUNTRIES.find(c => c.code === 'IT')!;
  if (lang.includes('BR')) return COUNTRIES.find(c => c.code === 'BR')!;
  if (lang.includes('JP')) return COUNTRIES.find(c => c.code === 'JP')!;
  if (lang.includes('KR')) return COUNTRIES.find(c => c.code === 'KR')!;
  if (lang.includes('IN')) return COUNTRIES.find(c => c.code === 'IN')!;

  // Default to United States
  return COUNTRIES.find(c => c.code === 'US') || COUNTRIES[2];
}
