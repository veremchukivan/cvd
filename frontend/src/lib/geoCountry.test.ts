import { guessCountryIso3FromBrowser } from './geoCountry';

describe('guessCountryIso3FromBrowser', () => {
  const originalDateTimeFormat = Intl.DateTimeFormat;
  const originalNavigatorLanguage = navigator.language;
  const originalNavigatorLanguages = navigator.languages;

  afterEach(() => {
    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: originalDateTimeFormat,
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: originalNavigatorLanguage,
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: originalNavigatorLanguages,
    });
  });

  it('prefers timezone over browser locale when choosing fallback country', () => {
    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: jest.fn(() => ({
        resolvedOptions: () => ({ timeZone: 'Europe/Bratislava' }),
      })),
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'en-US',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['en-US'],
    });

    expect(guessCountryIso3FromBrowser()).toBe('SVK');
  });

  it('falls back to browser locale when timezone is unavailable', () => {
    Object.defineProperty(Intl, 'DateTimeFormat', {
      configurable: true,
      value: jest.fn(() => ({
        resolvedOptions: () => ({ timeZone: 'Unknown/Zone' }),
      })),
    });
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'ru-RU',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['ru-RU'],
    });

    expect(guessCountryIso3FromBrowser()).toBe('RUS');
  });
});
