export interface Country {
  name: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Any Country', code: 'ALL', flag: '🌐' },
  { name: 'Jordan', code: 'JO', flag: '🇯🇴' },
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
  { name: 'Palestine', code: 'PS', flag: '🇵🇸' },
  { name: 'Iraq', code: 'IQ', flag: '🇮🇶' },
  { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
  { name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  { name: 'Oman', code: 'OM', flag: '🇴🇲' },
  { name: 'Morocco', code: 'MA', flag: '🇲🇦' },
  { name: 'Algeria', code: 'DZ', flag: '🇩🇿' },
  { name: 'Tunisia', code: 'TN', flag: '🇹🇳' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴' },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦' }
];

export function getCountryByCode(code: string): Country {
  const found = COUNTRIES.find(c => c.code.toUpperCase() === code.toUpperCase());
  return found || { name: 'United States', code: 'US', flag: '🇺🇸' };
}

export function getCountryByName(name: string): Country {
  const found = COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase());
  return found || { name: 'Any Country', code: 'ALL', flag: '🌐' };
}
