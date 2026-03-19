import { Metric, SummaryMetric } from '../types/map';

export type ThemeMode = 'obsidian' | 'ivory';
export type LocaleCode = 'en' | 'uk' | 'ru' | 'sk';

export const supportedLocales: LocaleCode[] = ['en', 'uk', 'ru', 'sk'];

const INTL_LOCALE_BY_CODE: Record<LocaleCode, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  ru: 'ru-RU',
  sk: 'sk-SK',
};

const METRIC_LABELS: Record<LocaleCode, Record<Metric, string>> = {
  en: {
    cases: 'Cases',
    deaths: 'Deaths',
    recovered: 'Recovered',
    vaccinations_total: 'Vaccinations',
    active: 'Active',
    tests: 'Tests',
    incidence: 'Incidence',
    mortality: 'Mortality (%)',
  },
  uk: {
    cases: 'Випадки',
    deaths: 'Смерті',
    recovered: 'Одужання',
    vaccinations_total: 'Вакцинації',
    active: 'Активні',
    tests: 'Тести',
    incidence: 'Інцидентність',
    mortality: 'Смертність (%)',
  },
  ru: {
    cases: 'Случаи',
    deaths: 'Смерти',
    recovered: 'Выздоровления',
    vaccinations_total: 'Вакцинации',
    active: 'Активные',
    tests: 'Тесты',
    incidence: 'Заболеваемость',
    mortality: 'Летальность (%)',
  },
  sk: {
    cases: 'Prípady',
    deaths: 'Úmrtia',
    recovered: 'Uzdravenia',
    vaccinations_total: 'Očkovania',
    active: 'Aktívne',
    tests: 'Testy',
    incidence: 'Incidencia',
    mortality: 'Úmrtnosť (%)',
  },
};

const SUMMARY_METRIC_LABELS: Record<LocaleCode, Record<SummaryMetric, string>> = {
  en: {
    today_cases: 'Cases (daily)',
    today_deaths: 'Deaths (daily)',
    today_recovered: 'Recovered (daily)',
    today_vaccinations: 'Vaccinations (daily)',
    cases: 'Cases',
    deaths: 'Deaths',
    recovered: 'Recovered',
    active: 'Active',
    tests: 'Tests',
    vaccinations_total: 'Vaccinations (total)',
    incidence: 'Incidence',
    mortality: 'Mortality (%)',
  },
  uk: {
    today_cases: 'Випадки (за день)',
    today_deaths: 'Смерті (за день)',
    today_recovered: 'Одужання (за день)',
    today_vaccinations: 'Вакцинації (за день)',
    cases: 'Випадки',
    deaths: 'Смерті',
    recovered: 'Одужання',
    active: 'Активні',
    tests: 'Тести',
    vaccinations_total: 'Вакцинації (загалом)',
    incidence: 'Інцидентність',
    mortality: 'Смертність (%)',
  },
  ru: {
    today_cases: 'Случаи (за день)',
    today_deaths: 'Смерти (за день)',
    today_recovered: 'Выздоровления (за день)',
    today_vaccinations: 'Вакцинации (за день)',
    cases: 'Случаи',
    deaths: 'Смерти',
    recovered: 'Выздоровления',
    active: 'Активные',
    tests: 'Тесты',
    vaccinations_total: 'Вакцинации (всего)',
    incidence: 'Заболеваемость',
    mortality: 'Летальность (%)',
  },
  sk: {
    today_cases: 'Prípady (denne)',
    today_deaths: 'Úmrtia (denne)',
    today_recovered: 'Uzdravenia (denne)',
    today_vaccinations: 'Očkovania (denne)',
    cases: 'Prípady',
    deaths: 'Úmrtia',
    recovered: 'Uzdravenia',
    active: 'Aktívne',
    tests: 'Testy',
    vaccinations_total: 'Očkovania (spolu)',
    incidence: 'Incidencia',
    mortality: 'Úmrtnosť (%)',
  },
};

export function isSupportedLocale(value: string | null | undefined): value is LocaleCode {
  return Boolean(value && supportedLocales.includes(value as LocaleCode));
}

export function resolveUiLocale(locale?: LocaleCode): LocaleCode {
  if (locale) {
    return locale;
  }

  const hintedLocales = supportedLocales.filter((item) => item !== 'en');

  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang.trim().toLowerCase();
    for (const candidate of hintedLocales) {
      if (lang.startsWith(candidate)) {
        return candidate;
      }
    }
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('cvd-locale');
    if (isSupportedLocale(stored)) {
      return stored;
    }
  }

  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();
    for (const candidate of hintedLocales) {
      if (lang.startsWith(candidate)) {
        return candidate;
      }
    }
  }

  return 'en';
}

export function intlLocale(locale?: LocaleCode): string {
  return INTL_LOCALE_BY_CODE[resolveUiLocale(locale)];
}

export function formatNumericValue(
  value: number,
  locale?: LocaleCode,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function metricLabel(metric: Metric, locale?: LocaleCode): string {
  return METRIC_LABELS[resolveUiLocale(locale)][metric] || metric;
}

export function summaryMetricLabel(metric: SummaryMetric, locale?: LocaleCode): string {
  return SUMMARY_METRIC_LABELS[resolveUiLocale(locale)][metric] || metric;
}

export function metricOptionLabel(metric: Metric, locale?: LocaleCode): string {
  if (metric === 'cases') return summaryMetricLabel('today_cases', locale);
  if (metric === 'deaths') return summaryMetricLabel('today_deaths', locale);
  if (metric === 'recovered') return summaryMetricLabel('today_recovered', locale);
  if (metric === 'vaccinations_total') return summaryMetricLabel('vaccinations_total', locale);
  return summaryMetricLabel(metric, locale);
}

export function localeNativeLabel(locale: LocaleCode): string {
  switch (locale) {
    case 'uk':
      return 'Українська';
    case 'ru':
      return 'Русский';
    case 'sk':
      return 'Slovenčina';
    default:
      return 'English';
  }
}

export const appCopy = {
  en: {
    appName: 'COVID 3D Atlas',
    nav: {
      eyebrow: 'Navigation',
      title: 'Workspace',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
      items: {
        map: 'Map',
        worldwide: 'COVID Worldwide',
        charts: 'Graphs',
        compare: 'Compare countries',
        about: 'About',
        faq: 'FAQ',
        settings: 'Settings',
      },
    },
    sidebar: {
      eyebrow: 'Preferences',
      note: 'Appearance and interface language now live in Settings.',
      openSettings: 'Open Settings',
    },
    settings: {
      eyebrow: 'Preferences center',
      title: 'Settings',
      lede:
        'Move appearance and language controls out of the workspace chrome and keep them in one dedicated place.',
      appearanceKicker: 'Appearance',
      appearanceTitle: 'Theme mode',
      appearanceSubtitle:
        'Pick the default shell palette for the entire dashboard. The change applies immediately.',
      languageKicker: 'Localization',
      languageTitle: 'Interface language',
      languageSubtitle:
        'Choose which language the shell, page headings, and shared controls should use.',
      previewKicker: 'Current profile',
      previewTitle: 'Live preferences preview',
      previewSubtitle:
        'Theme and locale are stored in the browser and restored automatically on the next visit.',
      currentTheme: 'Current theme',
      currentLanguage: 'Current language',
      themeOptions: {
        obsidian: {
          title: 'Black theme',
          description: 'Dark cinematic shell with high contrast and illuminated map layers.',
        },
        ivory: {
          title: 'White theme',
          description: 'Light ivory shell with softer surfaces and a brighter data stage.',
        },
      },
      languageOptions: {
        en: {
          description: 'Interface copy stays in English.',
        },
        uk: {
          description: 'The interface switches to Ukrainian.',
        },
        ru: {
          description: 'The interface switches to Russian.',
        },
        sk: {
          description: 'The interface switches to Slovak.',
        },
      },
    },
    filters: {
      metric: 'Metric',
      viewMode: 'View mode',
      dateMode: 'Date mode',
      singleDay: 'Single day',
      period: 'Period',
      total: 'Total',
      dayShort: 'Day',
      rangeShort: 'Range',
      date: 'Date',
      dateRange: 'Date range',
      dateSnapshot: 'Date snapshot',
      periodWindow: 'Period window',
      today: 'Today',
      yesterday: 'Yesterday',
      daysAgo7: '7d ago',
      daysAgo30: '30d ago',
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      ytd: 'YTD',
      reset: 'Reset',
      clearFilters: 'Clear filters',
      allTimeAggregate: 'All-time aggregate (without dates)',
      country: 'Country',
      primaryCountry: 'Primary country',
      compareWith: 'Compare with',
      searchCountryPlaceholder: 'Search country or open list...',
      searchPrimaryPlaceholder: 'Search primary country...',
      searchSecondPlaceholder: 'Search second country...',
      toggleCountryList: 'Toggle country list',
      togglePrimaryCountryList: 'Toggle primary country list',
      toggleCompareCountryList: 'Toggle compare country list',
      clearCountrySearch: 'Clear country search',
      none: 'None',
      noCountriesFound: 'No countries found',
      countryRanking: 'Country ranking',
      rankingLevel: 'Ranking level',
      countryOption: 'Country',
      continentOption: 'Continent',
    },
    map: {
      eyebrow: 'COVID explorer',
      title: 'COVID 3D Atlas',
      lede:
        'Explore COVID data on an interactive 3D globe. Rotate the world, pick a metric, and filter by single day, period, or total mode from the control dock below the map.',
      bannerError: 'Unable to load map data',
      cardEyebrow: '3D world view',
      cardHint: 'Rotate, hover, and click for full details',
      allTime: 'All time',
      legendScaleSuffix: 'scale',
      legendNoData: 'No data',
      legendSelectedCountry: 'Selected country',
      footerHint:
        'Data source: WHO + Johns Hopkins CSSE • Drag globe to rotate • Click country to jump to the details panel',
    },
    charts: {
      eyebrow: 'Country analytics',
      title: 'Country Graphs',
      lede:
        'Explore flow, weekly rhythm and outcome mix for one country in a selected day, period, or total mode.',
      bannerError: 'Unable to load one or more country metrics.',
      defaultCountry: 'Country',
      snapshot: 'Snapshot',
      countryOverview: 'Country overview',
      peakDailyCases: 'Peak daily cases',
      peakDailyDeaths: 'Peak daily deaths',
      peakMortality: 'Peak mortality',
      noPeakData: 'No peak data',
      allTime: 'All time',
    },
    compare: {
      eyebrow: 'Country comparison',
      title: 'Compare Countries',
      lede:
        'Compare two countries for a selected day or period with trend, gap, ratio, normalized index and share charts.',
      bannerError: 'Unable to load comparison data.',
      defaultPrimaryCountry: 'Primary country',
      compareCountry: 'Compare country',
      selectSecondCountry: 'Select second country',
      allTime: 'All time',
    },
    worldwide: {
      eyebrow: 'Global monitor',
      title: 'COVID Worldwide',
      lede:
        'Global dashboard with redesigned visuals, expanded analytics and interactive chart controls for the selected period. Vaccination comparisons are available in total mode.',
      modeLabel: 'Mode',
      windowLabel: 'Window',
      rankingLabel: 'Ranking',
      topPrefix: 'Top',
      metricFallback: 'Metric',
      liveRanking: 'Live ranking',
      bannerError: 'Unable to load worldwide data.',
      allTime: 'All time',
      daySnapshot: 'Day snapshot',
      rangeWindow: 'Range window',
      allTimeMode: 'All-time',
      countries: 'countries',
      continents: 'continents',
      noCountriesYet: 'No countries yet',
      noContinentsYet: 'No continents yet',
    },
    about: {
      eyebrow: 'About project',
      title: 'About COVID 3D Atlas (OWID / WHO / Worldometer)',
      lede:
        'This page summarizes public COVID-19 case-reporting context from Our World in Data, WHO Dashboard, and Worldometer, reviewed on March 10, 2026.',
      highlightsLabel: 'Project highlights',
      highlights: [
        {
          kicker: 'OWID interpretation',
          title: 'Confirmed cases vs real infections',
          body:
            'OWID states that confirmed cases reflect tested-and-confirmed infections, while actual infections are typically higher because testing is incomplete and reporting is delayed.',
        },
        {
          kicker: 'WHO reporting format',
          title: 'Weekly dashboard logic',
          body:
            'WHO explains that countries now report at different frequencies. Since August 25, 2023, WHO requested stronger weekly reporting, and the dashboard emphasizes weekly indicators to reduce misinterpretation of sparse daily reporting.',
        },
        {
          kicker: 'Worldometer status',
          title: 'Historical access only',
          body:
            'Worldometer states that its coronavirus tracker stopped updating on April 13, 2024 due to limited feasibility of statistically valid global live totals, while historical data remains accessible.',
        },
      ],
      secondary: [
        {
          kicker: 'Data lineage',
          title: 'OWID and WHO linkage',
          body:
            'OWID documents that its confirmed case/death visualizations rely on WHO data, and OWID publishes downloadable files in CSV/XLSX/JSON plus GitHub access for reproducibility.',
        },
        {
          kicker: 'Comparability limits',
          title: 'Why sources can differ',
          body:
            'WHO and OWID both note differences across countries in definitions, test strategies, and reporting lags. WHO also notes retrospective corrections can create spikes or even negative weekly values in reported data.',
        },
      ],
      sourcesKicker: 'Sources',
      sourcesTitle: 'Pages used for this section',
      disclaimerKicker: 'Disclaimer',
      disclaimerTitle: 'Information purpose',
      disclaimerBody:
        'This dashboard is informational and summarizes reported case data. It is not a diagnostic or clinical decision tool.',
    },
    faq: {
      eyebrow: 'Help center',
      title: 'Frequently Asked Questions',
      lede:
        'These answers summarize OWID, WHO Dashboard, and Worldometer reporting context plus how this dashboard displays available data.',
      listLabel: 'FAQ list',
      items: [
        {
          question: 'Why can OWID, WHO, and Worldometer show different numbers?',
          answer:
            'Sources use different reporting pipelines, update timings, and country submissions. WHO and OWID both note that national testing and reporting practices vary, which affects comparability.',
        },
        {
          question: 'Does WHO still publish daily global case counts?',
          answer:
            'WHO dashboard messaging emphasizes weekly reporting and trend interpretation. WHO also notes countries report at different frequencies, so daily interpretation can be misleading.',
        },
        {
          question: 'What changed on August 25, 2023 in WHO reporting guidance?',
          answer:
            'WHO requested countries to continue strong weekly reporting from August 25, 2023 and shifted dashboard emphasis to weekly indicators to reflect current data quality.',
        },
        {
          question: 'Why can weekly data sometimes contain negative values?',
          answer:
            'WHO explains that retrospective data cleaning and reclassification by countries can produce apparent negative corrections in specific weeks.',
        },
        {
          question: 'Is Worldometer still updating COVID totals every day?',
          answer:
            'According to its own notice, Worldometer stopped updating its COVID tracker on April 13, 2024, but keeps historical data and archives available.',
        },
        {
          question: 'What does OWID mean by confirmed cases?',
          answer:
            'OWID defines confirmed cases as infections confirmed by a test. OWID also states confirmed counts are lower than true infections because not everyone is tested.',
        },
        {
          question: 'Where does OWID case data come from?',
          answer:
            'OWID documentation on the cases page says its confirmed case/death dataset relies on WHO reporting.',
        },
        {
          question: 'Why can this dashboard show no data for some places or dates?',
          answer:
            'No-data appears when a value is absent for the selected metric/date mode in the ingested dataset, or when a source has reporting gaps in the selected period.',
        },
        {
          question: 'Where can I verify source methodology directly?',
          answer:
            'Open the About page source links: OWID cases documentation, WHO dashboard page, and Worldometer tracker/about pages.',
        },
      ],
    },
  },
  uk: {
    appName: 'COVID 3D Atlas',
    nav: {
      eyebrow: 'Навігація',
      title: 'Робочий простір',
      openMenu: 'Відкрити меню навігації',
      closeMenu: 'Закрити меню навігації',
      items: {
        map: 'Карта',
        worldwide: 'Світовий огляд',
        charts: 'Графіки',
        compare: 'Порівняння країн',
        about: 'Про проєкт',
        faq: 'FAQ',
        settings: 'Налаштування',
      },
    },
    sidebar: {
      eyebrow: 'Параметри',
      note: 'Зміну теми та мови інтерфейсу винесено на окрему сторінку налаштувань.',
      openSettings: 'Відкрити налаштування',
    },
    settings: {
      eyebrow: 'Центр параметрів',
      title: 'Налаштування',
      lede:
        'Керуйте зовнішнім виглядом і мовою інтерфейсу в одному окремому розділі, а не в бічній панелі.',
      appearanceKicker: 'Оформлення',
      appearanceTitle: 'Тема інтерфейсу',
      appearanceSubtitle:
        'Оберіть базову палітру для всього дашборда. Зміни застосовуються відразу.',
      languageKicker: 'Локалізація',
      languageTitle: 'Мова інтерфейсу',
      languageSubtitle:
        'Оберіть мову для оболонки застосунку, заголовків сторінок і спільних елементів керування.',
      previewKicker: 'Поточний профіль',
      previewTitle: 'Живий перегляд параметрів',
      previewSubtitle:
        'Тема та мова зберігаються в браузері й автоматично відновлюються під час наступного відкриття.',
      currentTheme: 'Поточна тема',
      currentLanguage: 'Поточна мова',
      themeOptions: {
        obsidian: {
          title: 'Чорна тема',
          description: 'Темна кінематографічна оболонка з контрастною картою та підсвіченими шарами.',
        },
        ivory: {
          title: 'Біла тема',
          description: 'Світла айворі-оболонка з м’якшими поверхнями й яскравішою сценою даних.',
        },
      },
      languageOptions: {
        en: {
          description: 'Інтерфейс залишиться англійською мовою.',
        },
        uk: {
          description: 'Інтерфейс перемикається на українську мову.',
        },
        ru: {
          description: 'Інтерфейс перемикається на російську мову.',
        },
        sk: {
          description: 'Інтерфейс перемикається на словацьку мову.',
        },
      },
    },
    filters: {
      metric: 'Метрика',
      viewMode: 'Режим перегляду',
      dateMode: 'Режим дати',
      singleDay: 'Один день',
      period: 'Період',
      total: 'Підсумок',
      dayShort: 'День',
      rangeShort: 'Період',
      date: 'Дата',
      dateRange: 'Діапазон дат',
      dateSnapshot: 'Знімок на дату',
      periodWindow: 'Період вибірки',
      today: 'Сьогодні',
      yesterday: 'Учора',
      daysAgo7: '7 днів тому',
      daysAgo30: '30 днів тому',
      last7Days: 'Останні 7 днів',
      last30Days: 'Останні 30 днів',
      ytd: 'З початку року',
      reset: 'Скидання',
      clearFilters: 'Очистити фільтри',
      allTimeAggregate: 'Підсумок за весь час (без дат)',
      country: 'Країна',
      primaryCountry: 'Основна країна',
      compareWith: 'Порівняти з',
      searchCountryPlaceholder: 'Знайдіть країну або відкрийте список...',
      searchPrimaryPlaceholder: 'Знайдіть основну країну...',
      searchSecondPlaceholder: 'Знайдіть другу країну...',
      toggleCountryList: 'Перемкнути список країн',
      togglePrimaryCountryList: 'Перемкнути список основної країни',
      toggleCompareCountryList: 'Перемкнути список країни для порівняння',
      clearCountrySearch: 'Очистити пошук країни',
      none: 'Немає',
      noCountriesFound: 'Країн не знайдено',
      countryRanking: 'Рейтинг країн',
      rankingLevel: 'Рівень рейтингу',
      countryOption: 'Країна',
      continentOption: 'Континент',
    },
    map: {
      eyebrow: 'Огляд COVID',
      title: 'COVID 3D Atlas',
      lede:
        'Досліджуйте дані COVID на інтерактивному 3D-глобусі. Обертайте світ, обирайте метрику та фільтруйте дані за один день, період або весь час через панель під картою.',
      bannerError: 'Не вдалося завантажити дані карти',
      cardEyebrow: '3D-вид світу',
      cardHint: 'Обертайте, наводьте курсор і натискайте для деталей',
      allTime: 'Увесь час',
      legendScaleSuffix: 'шкала',
      legendNoData: 'Немає даних',
      legendSelectedCountry: 'Обрана країна',
      footerHint:
        'Джерело даних: WHO + Johns Hopkins CSSE • Перетягуйте глобус для обертання • Натисніть країну, щоб перейти до панелі деталей',
    },
    charts: {
      eyebrow: 'Аналітика країни',
      title: 'Графіки країни',
      lede:
        'Досліджуйте потоки, тижневий ритм і структуру результатів для однієї країни в режимі дня, періоду або загального підсумку.',
      bannerError: 'Не вдалося завантажити одну або кілька метрик країни.',
      defaultCountry: 'Країна',
      snapshot: 'Знімок',
      countryOverview: 'Огляд країни',
      peakDailyCases: 'Пік денних випадків',
      peakDailyDeaths: 'Пік денних смертей',
      peakMortality: 'Пік смертності',
      noPeakData: 'Немає даних про пік',
      allTime: 'Увесь час',
    },
    compare: {
      eyebrow: 'Порівняння країн',
      title: 'Порівняння країн',
      lede:
        'Порівнюйте дві країни за вибраний день або період через графіки трендів, розриву, співвідношення, нормалізованого індексу та частки.',
      bannerError: 'Не вдалося завантажити дані для порівняння.',
      defaultPrimaryCountry: 'Основна країна',
      compareCountry: 'Країна для порівняння',
      selectSecondCountry: 'Оберіть другу країну',
      allTime: 'Увесь час',
    },
    worldwide: {
      eyebrow: 'Глобальний монітор',
      title: 'Світовий огляд COVID',
      lede:
        'Глобальний дашборд із оновленою візуальною подачею, розширеною аналітикою та інтерактивними графіками для вибраного періоду. Порівняння вакцинації доступне в режимі підсумку.',
      modeLabel: 'Режим',
      windowLabel: 'Вікно',
      rankingLabel: 'Рейтинг',
      topPrefix: 'Топ',
      metricFallback: 'Метрика',
      liveRanking: 'Живий рейтинг',
      bannerError: 'Не вдалося завантажити світові дані.',
      allTime: 'Увесь час',
      daySnapshot: 'Знімок дня',
      rangeWindow: 'Період',
      allTimeMode: 'За весь час',
      countries: 'країн',
      continents: 'континентів',
      noCountriesYet: 'Поки немає країн',
      noContinentsYet: 'Поки немає континентів',
    },
    about: {
      eyebrow: 'Про проєкт',
      title: 'Про COVID 3D Atlas (OWID / WHO / Worldometer)',
      lede:
        'На цій сторінці зібрано контекст публічної звітності щодо випадків COVID-19 з Our World in Data, WHO Dashboard і Worldometer станом на 10 березня 2026 року.',
      highlightsLabel: 'Ключові акценти проєкту',
      highlights: [
        {
          kicker: 'Тлумачення OWID',
          title: 'Підтверджені випадки проти реальних інфекцій',
          body:
            'OWID зазначає, що підтверджені випадки відображають лише інфекції, підтверджені тестуванням, тоді як реальна кількість заражень зазвичай вища через неповне тестування та затримки у звітності.',
        },
        {
          kicker: 'Формат звітності WHO',
          title: 'Логіка тижневого дашборда',
          body:
            'WHO пояснює, що країни тепер звітують з різною частотою. З 25 серпня 2023 року WHO посилила вимогу до щотижневої звітності, а дашборд робить акцент на тижневих індикаторах, щоб зменшити хибні висновки з рідких денних звітів.',
        },
        {
          kicker: 'Статус Worldometer',
          title: 'Лише історичний доступ',
          body:
            'Worldometer повідомляє, що 13 квітня 2024 року припинив оновлювати COVID-трекер через обмежену можливість підтримувати статистично коректні глобальні лайв-підсумки, але історичні дані залишилися доступними.',
        },
      ],
      secondary: [
        {
          kicker: 'Походження даних',
          title: 'Зв’язок OWID і WHO',
          body:
            'OWID документує, що його візуалізації підтверджених випадків і смертей спираються на дані WHO, а також публікує файли CSV/XLSX/JSON і GitHub-доступ для відтворюваності.',
        },
        {
          kicker: 'Обмеження порівнюваності',
          title: 'Чому джерела можуть відрізнятися',
          body:
            'І WHO, і OWID вказують на відмінності між країнами в означеннях, стратегіях тестування та затримках звітності. WHO також зазначає, що ретроспективні виправлення можуть створювати піки або навіть від’ємні тижневі значення.',
        },
      ],
      sourcesKicker: 'Джерела',
      sourcesTitle: 'Сторінки, використані для цього розділу',
      disclaimerKicker: 'Застереження',
      disclaimerTitle: 'Інформаційне призначення',
      disclaimerBody:
        'Цей дашборд має інформаційний характер і підсумовує зареєстровані дані щодо випадків. Він не є інструментом для діагностики чи клінічних рішень.',
    },
    faq: {
      eyebrow: 'Центр допомоги',
      title: 'Поширені запитання',
      lede:
        'Ці відповіді підсумовують контекст звітності OWID, WHO Dashboard і Worldometer, а також пояснюють, як цей дашборд показує доступні дані.',
      listLabel: 'Список запитань',
      items: [
        {
          question: 'Чому OWID, WHO і Worldometer можуть показувати різні числа?',
          answer:
            'Джерела використовують різні канали звітності, час оновлення та національні подання. І WHO, і OWID зазначають, що практики тестування та звітності відрізняються між країнами, тому повна порівнюваність обмежена.',
        },
        {
          question: 'Чи WHO досі публікує щоденні глобальні підрахунки випадків?',
          answer:
            'Повідомлення WHO у дашборді роблять акцент на щотижневій звітності та інтерпретації трендів. WHO також зазначає, що країни звітують з різною частотою, тому денне трактування може бути хибним.',
        },
        {
          question: 'Що змінилося 25 серпня 2023 року в рекомендаціях WHO щодо звітності?',
          answer:
            'WHO попросила країни продовжувати якісну щотижневу звітність з 25 серпня 2023 року і змістила акцент дашборда на тижневі індикатори відповідно до поточної якості даних.',
        },
        {
          question: 'Чому тижневі дані інколи можуть містити від’ємні значення?',
          answer:
            'WHO пояснює, що ретроспективне очищення даних і перекласифікація записів з боку країн можуть створювати видимі від’ємні корекції в окремі тижні.',
        },
        {
          question: 'Чи Worldometer ще оновлює щоденні COVID-підсумки?',
          answer:
            'Згідно з власним повідомленням, Worldometer припинив оновлювати COVID-трекер 13 квітня 2024 року, але зберігає історичні дані й архіви.',
        },
        {
          question: 'Що OWID має на увазі під підтвердженими випадками?',
          answer:
            'OWID визначає підтверджені випадки як інфекції, підтверджені тестом. Також OWID прямо зазначає, що підтверджені цифри нижчі за реальні зараження, бо тестування проходять не всі.',
        },
        {
          question: 'Звідки OWID бере дані про випадки?',
          answer:
            'У документації OWID на сторінці про випадки сказано, що їхній набір даних про підтверджені випадки та смерті спирається на звітність WHO.',
        },
        {
          question: 'Чому цей дашборд може показувати відсутність даних для деяких місць або дат?',
          answer:
            'Стан "немає даних" з’являється, коли для вибраної метрики або режиму дати значення відсутнє в завантаженому наборі даних, або коли джерело має прогалини у звітності за вибраний період.',
        },
        {
          question: 'Де можна напряму перевірити методологію джерел?',
          answer:
            'Відкрийте посилання на сторінці "Про проєкт": документацію OWID щодо випадків, сторінку дашборда WHO та сторінки трекера/about від Worldometer.',
        },
      ],
    },
  },
  ru: {
    appName: 'COVID 3D Atlas',
    nav: {
      eyebrow: 'Навигация',
      title: 'Рабочее пространство',
      openMenu: 'Открыть меню навигации',
      closeMenu: 'Закрыть меню навигации',
      items: {
        map: 'Карта',
        worldwide: 'Мировой обзор',
        charts: 'Графики',
        compare: 'Сравнение стран',
        about: 'О проекте',
        faq: 'FAQ',
        settings: 'Настройки',
      },
    },
    sidebar: {
      eyebrow: 'Параметры',
      note: 'Переключение темы и языка интерфейса вынесено на отдельную страницу настроек.',
      openSettings: 'Открыть настройки',
    },
    settings: {
      eyebrow: 'Центр параметров',
      title: 'Настройки',
      lede:
        'Управляйте внешним видом и языком интерфейса в одном отдельном разделе, а не в боковой панели.',
      appearanceKicker: 'Оформление',
      appearanceTitle: 'Тема интерфейса',
      appearanceSubtitle:
        'Выберите базовую палитру для всего дашборда. Изменения применяются сразу.',
      languageKicker: 'Локализация',
      languageTitle: 'Язык интерфейса',
      languageSubtitle:
        'Выберите язык оболочки приложения, заголовков страниц и общих элементов управления.',
      previewKicker: 'Текущий профиль',
      previewTitle: 'Живой предпросмотр настроек',
      previewSubtitle:
        'Тема и язык сохраняются в браузере и автоматически восстанавливаются при следующем открытии.',
      currentTheme: 'Текущая тема',
      currentLanguage: 'Текущий язык',
      themeOptions: {
        obsidian: {
          title: 'Черная тема',
          description: 'Темная кинематографичная оболочка с контрастной картой и подсвеченными слоями.',
        },
        ivory: {
          title: 'Белая тема',
          description: 'Светлая ivory-оболочка с более мягкими поверхностями и яркой сценой данных.',
        },
      },
      languageOptions: {
        en: {
          description: 'Интерфейс останется на английском языке.',
        },
        uk: {
          description: 'Интерфейс переключится на украинский язык.',
        },
        ru: {
          description: 'Интерфейс переключится на русский язык.',
        },
        sk: {
          description: 'Интерфейс переключится на словацкий язык.',
        },
      },
    },
    filters: {
      metric: 'Метрика',
      viewMode: 'Режим просмотра',
      dateMode: 'Режим даты',
      singleDay: 'Один день',
      period: 'Период',
      total: 'Итог',
      dayShort: 'День',
      rangeShort: 'Период',
      date: 'Дата',
      dateRange: 'Диапазон дат',
      dateSnapshot: 'Снимок на дату',
      periodWindow: 'Окно периода',
      today: 'Сегодня',
      yesterday: 'Вчера',
      daysAgo7: '7 дней назад',
      daysAgo30: '30 дней назад',
      last7Days: 'Последние 7 дней',
      last30Days: 'Последние 30 дней',
      ytd: 'С начала года',
      reset: 'Сброс',
      clearFilters: 'Очистить фильтры',
      allTimeAggregate: 'Итог за все время (без дат)',
      country: 'Страна',
      primaryCountry: 'Основная страна',
      compareWith: 'Сравнить с',
      searchCountryPlaceholder: 'Найдите страну или откройте список...',
      searchPrimaryPlaceholder: 'Найдите основную страну...',
      searchSecondPlaceholder: 'Найдите вторую страну...',
      toggleCountryList: 'Переключить список стран',
      togglePrimaryCountryList: 'Переключить список основной страны',
      toggleCompareCountryList: 'Переключить список страны для сравнения',
      clearCountrySearch: 'Очистить поиск страны',
      none: 'Нет',
      noCountriesFound: 'Страны не найдены',
      countryRanking: 'Рейтинг стран',
      rankingLevel: 'Уровень рейтинга',
      countryOption: 'Страна',
      continentOption: 'Континент',
    },
    map: {
      eyebrow: 'Обзор COVID',
      title: 'COVID 3D Atlas',
      lede:
        'Изучайте данные COVID на интерактивном 3D-глобусе. Вращайте мир, выбирайте метрику и фильтруйте данные по одному дню, периоду или за все время через панель под картой.',
      bannerError: 'Не удалось загрузить данные карты',
      cardEyebrow: '3D-вид мира',
      cardHint: 'Вращайте, наводите курсор и нажимайте для подробностей',
      allTime: 'Все время',
      legendScaleSuffix: 'шкала',
      legendNoData: 'Нет данных',
      legendSelectedCountry: 'Выбранная страна',
      footerHint:
        'Источник данных: WHO + Johns Hopkins CSSE • Перетаскивайте глобус для вращения • Нажмите на страну, чтобы перейти к панели деталей',
    },
    charts: {
      eyebrow: 'Аналитика страны',
      title: 'Графики страны',
      lede:
        'Изучайте потоки, недельный ритм и структуру результатов для одной страны в режиме дня, периода или общего итога.',
      bannerError: 'Не удалось загрузить одну или несколько метрик страны.',
      defaultCountry: 'Страна',
      snapshot: 'Снимок',
      countryOverview: 'Обзор страны',
      peakDailyCases: 'Пик дневных случаев',
      peakDailyDeaths: 'Пик дневных смертей',
      peakMortality: 'Пик летальности',
      noPeakData: 'Нет данных о пике',
      allTime: 'Все время',
    },
    compare: {
      eyebrow: 'Сравнение стран',
      title: 'Сравнение стран',
      lede:
        'Сравнивайте две страны за выбранный день или период с помощью графиков тренда, разрыва, соотношения, нормализованного индекса и доли.',
      bannerError: 'Не удалось загрузить данные для сравнения.',
      defaultPrimaryCountry: 'Основная страна',
      compareCountry: 'Страна для сравнения',
      selectSecondCountry: 'Выберите вторую страну',
      allTime: 'Все время',
    },
    worldwide: {
      eyebrow: 'Глобальный монитор',
      title: 'Мировой обзор COVID',
      lede:
        'Глобальный дашборд с обновленной визуальной подачей, расширенной аналитикой и интерактивными графиками для выбранного периода. Сравнение вакцинации доступно в режиме итога.',
      modeLabel: 'Режим',
      windowLabel: 'Окно',
      rankingLabel: 'Рейтинг',
      topPrefix: 'Топ',
      metricFallback: 'Метрика',
      liveRanking: 'Живой рейтинг',
      bannerError: 'Не удалось загрузить мировые данные.',
      allTime: 'Все время',
      daySnapshot: 'Снимок дня',
      rangeWindow: 'Период',
      allTimeMode: 'За все время',
      countries: 'стран',
      continents: 'континентов',
      noCountriesYet: 'Пока нет стран',
      noContinentsYet: 'Пока нет континентов',
    },
    about: {
      eyebrow: 'О проекте',
      title: 'О COVID 3D Atlas (OWID / WHO / Worldometer)',
      lede:
        'Эта страница кратко описывает контекст публичной отчетности по случаям COVID-19 из Our World in Data, WHO Dashboard и Worldometer по состоянию на 10 марта 2026 года.',
      highlightsLabel: 'Ключевые акценты проекта',
      highlights: [
        {
          kicker: 'Интерпретация OWID',
          title: 'Подтвержденные случаи и реальные инфекции',
          body:
            'OWID отмечает, что подтвержденные случаи отражают только инфекции, подтвержденные тестами, тогда как реальное число заражений обычно выше из-за неполного тестирования и задержек в отчетности.',
        },
        {
          kicker: 'Формат отчетности WHO',
          title: 'Логика недельного дашборда',
          body:
            'WHO объясняет, что страны теперь отчитываются с разной частотой. С 25 августа 2023 года WHO усилила акцент на еженедельной отчетности, а дашборд делает упор на недельные индикаторы, чтобы снизить риск неверной интерпретации редких дневных данных.',
        },
        {
          kicker: 'Статус Worldometer',
          title: 'Только исторический доступ',
          body:
            'Worldometer сообщает, что 13 апреля 2024 года прекратил обновление COVID-трекера из-за ограниченной возможности поддерживать статистически корректные глобальные live-итоги, однако исторические данные по-прежнему доступны.',
        },
      ],
      secondary: [
        {
          kicker: 'Происхождение данных',
          title: 'Связь OWID и WHO',
          body:
            'OWID документирует, что визуализации подтвержденных случаев и смертей опираются на данные WHO, а также публикует выгружаемые файлы CSV/XLSX/JSON и доступ через GitHub для воспроизводимости.',
        },
        {
          kicker: 'Ограничения сопоставимости',
          title: 'Почему источники могут различаться',
          body:
            'И WHO, и OWID указывают на различия между странами в определениях, стратегиях тестирования и задержках отчетности. WHO также отмечает, что ретроспективные исправления могут создавать пики или даже отрицательные недельные значения.',
        },
      ],
      sourcesKicker: 'Источники',
      sourcesTitle: 'Страницы, использованные в этом разделе',
      disclaimerKicker: 'Дисклеймер',
      disclaimerTitle: 'Информационное назначение',
      disclaimerBody:
        'Этот дашборд носит информационный характер и суммирует зарегистрированные данные по случаям. Он не является инструментом для диагностики или клинических решений.',
    },
    faq: {
      eyebrow: 'Центр помощи',
      title: 'Часто задаваемые вопросы',
      lede:
        'Эти ответы обобщают контекст отчетности OWID, WHO Dashboard и Worldometer, а также объясняют, как этот дашборд показывает доступные данные.',
      listLabel: 'Список вопросов',
      items: [
        {
          question: 'Почему OWID, WHO и Worldometer могут показывать разные числа?',
          answer:
            'Источники используют разные каналы отчетности, время обновления и национальные подачи данных. И WHO, и OWID отмечают, что практики тестирования и отчетности различаются между странами, поэтому сопоставимость ограничена.',
        },
        {
          question: 'Публикует ли WHO по-прежнему ежедневные глобальные подсчеты случаев?',
          answer:
            'Сообщения WHO в дашборде делают акцент на еженедельной отчетности и интерпретации трендов. WHO также отмечает, что страны отчитываются с разной частотой, поэтому дневная интерпретация может вводить в заблуждение.',
        },
        {
          question: 'Что изменилось 25 августа 2023 года в рекомендациях WHO по отчетности?',
          answer:
            'WHO попросила страны продолжать качественную еженедельную отчетность с 25 августа 2023 года и сместила акцент дашборда на недельные индикаторы в соответствии с текущим качеством данных.',
        },
        {
          question: 'Почему недельные данные иногда могут содержать отрицательные значения?',
          answer:
            'WHO объясняет, что ретроспективная очистка данных и переклассификация записей со стороны стран могут создавать видимые отрицательные корректировки в отдельные недели.',
        },
        {
          question: 'Worldometer все еще обновляет ежедневные COVID-итоги?',
          answer:
            'Согласно собственному уведомлению, Worldometer прекратил обновление COVID-трекера 13 апреля 2024 года, но сохраняет исторические данные и архивы.',
        },
        {
          question: 'Что OWID подразумевает под подтвержденными случаями?',
          answer:
            'OWID определяет подтвержденные случаи как инфекции, подтвержденные тестом. OWID также прямо отмечает, что подтвержденные числа ниже реального количества инфекций, потому что тестирование проходят не все.',
        },
        {
          question: 'Откуда OWID берет данные о случаях?',
          answer:
            'В документации OWID на странице о случаях сказано, что их набор данных по подтвержденным случаям и смертям опирается на отчетность WHO.',
        },
        {
          question: 'Почему этот дашборд может показывать отсутствие данных для некоторых мест или дат?',
          answer:
            'Статус "нет данных" появляется, когда для выбранной метрики или режима даты значение отсутствует в загруженном наборе данных, либо когда источник имеет пробелы в отчетности за выбранный период.',
        },
        {
          question: 'Где можно напрямую проверить методологию источников?',
          answer:
            'Откройте ссылки на странице "О проекте": документацию OWID по случаям, страницу дашборда WHO и страницы трекера/about от Worldometer.',
        },
      ],
    },
  },
  sk: {
    appName: 'COVID 3D Atlas',
    nav: {
      eyebrow: 'Navigácia',
      title: 'Pracovný priestor',
      openMenu: 'Otvoriť navigačné menu',
      closeMenu: 'Zavrieť navigačné menu',
      items: {
        map: 'Mapa',
        worldwide: 'Svetový prehľad',
        charts: 'Grafy',
        compare: 'Porovnanie krajín',
        about: 'O projekte',
        faq: 'FAQ',
        settings: 'Nastavenia',
      },
    },
    sidebar: {
      eyebrow: 'Preferencie',
      note: 'Prepínanie témy a jazyka rozhrania je presunuté na samostatnú stránku nastavení.',
      openSettings: 'Otvoriť nastavenia',
    },
    settings: {
      eyebrow: 'Centrum preferencií',
      title: 'Nastavenia',
      lede:
        'Spravujte vzhľad a jazyk rozhrania v jednej samostatnej sekcii namiesto bočného panela.',
      appearanceKicker: 'Vzhľad',
      appearanceTitle: 'Téma rozhrania',
      appearanceSubtitle:
        'Vyberte základnú paletu pre celý dashboard. Zmena sa použije okamžite.',
      languageKicker: 'Lokalizácia',
      languageTitle: 'Jazyk rozhrania',
      languageSubtitle:
        'Vyberte jazyk shellu aplikácie, nadpisov stránok a spoločných ovládacích prvkov.',
      previewKicker: 'Aktuálny profil',
      previewTitle: 'Živý náhľad preferencií',
      previewSubtitle:
        'Téma aj jazyk sa ukladajú do prehliadača a pri ďalšej návšteve sa automaticky obnovia.',
      currentTheme: 'Aktuálna téma',
      currentLanguage: 'Aktuálny jazyk',
      themeOptions: {
        obsidian: {
          title: 'Čierna téma',
          description: 'Tmavý filmový shell s vysokým kontrastom a zvýraznenými vrstvami mapy.',
        },
        ivory: {
          title: 'Biela téma',
          description: 'Svetlý ivory shell s jemnejšími plochami a jasnejšou dátovou scénou.',
        },
      },
      languageOptions: {
        en: {
          description: 'Rozhranie zostane v angličtine.',
        },
        uk: {
          description: 'Rozhranie sa prepne do ukrajinčiny.',
        },
        ru: {
          description: 'Rozhranie sa prepne do ruštiny.',
        },
        sk: {
          description: 'Rozhranie sa prepne do slovenčiny.',
        },
      },
    },
    filters: {
      metric: 'Metrika',
      viewMode: 'Režim zobrazenia',
      dateMode: 'Režim dátumu',
      singleDay: 'Jeden deň',
      period: 'Obdobie',
      total: 'Súhrn',
      dayShort: 'Deň',
      rangeShort: 'Obdobie',
      date: 'Dátum',
      dateRange: 'Rozsah dátumov',
      dateSnapshot: 'Snímka dátumu',
      periodWindow: 'Okno obdobia',
      today: 'Dnes',
      yesterday: 'Včera',
      daysAgo7: 'Pred 7 dňami',
      daysAgo30: 'Pred 30 dňami',
      last7Days: 'Posledných 7 dní',
      last30Days: 'Posledných 30 dní',
      ytd: 'Od začiatku roka',
      reset: 'Reset',
      clearFilters: 'Vyčistiť filtre',
      allTimeAggregate: 'Súhrn za celé obdobie (bez dátumov)',
      country: 'Krajina',
      primaryCountry: 'Hlavná krajina',
      compareWith: 'Porovnať s',
      searchCountryPlaceholder: 'Vyhľadajte krajinu alebo otvorte zoznam...',
      searchPrimaryPlaceholder: 'Vyhľadajte hlavnú krajinu...',
      searchSecondPlaceholder: 'Vyhľadajte druhú krajinu...',
      toggleCountryList: 'Prepnúť zoznam krajín',
      togglePrimaryCountryList: 'Prepnúť zoznam hlavnej krajiny',
      toggleCompareCountryList: 'Prepnúť zoznam porovnávacej krajiny',
      clearCountrySearch: 'Vymazať vyhľadávanie krajiny',
      none: 'Žiadne',
      noCountriesFound: 'Nenašli sa žiadne krajiny',
      countryRanking: 'Rebríček krajín',
      rankingLevel: 'Úroveň rebríčka',
      countryOption: 'Krajina',
      continentOption: 'Kontinent',
    },
    map: {
      eyebrow: 'COVID prehľad',
      title: 'COVID 3D Atlas',
      lede:
        'Skúmajte COVID dáta na interaktívnom 3D glóbuse. Otáčajte svet, vyberte metriku a filtrujte údaje podľa jedného dňa, obdobia alebo celého času cez panel pod mapou.',
      bannerError: 'Nepodarilo sa načítať dáta mapy',
      cardEyebrow: '3D pohľad na svet',
      cardHint: 'Otáčajte, prechádzajte kurzorom a klikajte pre detaily',
      allTime: 'Celé obdobie',
      legendScaleSuffix: 'škála',
      legendNoData: 'Bez dát',
      legendSelectedCountry: 'Vybraná krajina',
      footerHint:
        'Zdroj dát: WHO + Johns Hopkins CSSE • Potiahnutím glóbus otočíte • Kliknite na krajinu a prejdite na panel detailov',
    },
    charts: {
      eyebrow: 'Analytika krajiny',
      title: 'Grafy krajiny',
      lede:
        'Skúmajte tok dát, týždenný rytmus a štruktúru výsledkov pre jednu krajinu v režime dňa, obdobia alebo celkového súhrnu.',
      bannerError: 'Nepodarilo sa načítať jednu alebo viac metrík krajiny.',
      defaultCountry: 'Krajina',
      snapshot: 'Snímka',
      countryOverview: 'Prehľad krajiny',
      peakDailyCases: 'Vrchol denných prípadov',
      peakDailyDeaths: 'Vrchol denných úmrtí',
      peakMortality: 'Vrchol úmrtnosti',
      noPeakData: 'Žiadne údaje o maxime',
      allTime: 'Celé obdobie',
    },
    compare: {
      eyebrow: 'Porovnanie krajín',
      title: 'Porovnanie krajín',
      lede:
        'Porovnajte dve krajiny za vybraný deň alebo obdobie pomocou grafov trendu, rozdielu, pomeru, normalizovaného indexu a podielu.',
      bannerError: 'Nepodarilo sa načítať dáta na porovnanie.',
      defaultPrimaryCountry: 'Hlavná krajina',
      compareCountry: 'Porovnávacia krajina',
      selectSecondCountry: 'Vyberte druhú krajinu',
      allTime: 'Celé obdobie',
    },
    worldwide: {
      eyebrow: 'Globálny monitor',
      title: 'Svetový prehľad COVID',
      lede:
        'Globálny dashboard s prepracovaným vizuálom, rozšírenou analytikou a interaktívnymi grafmi pre vybrané obdobie. Porovnanie očkovania je dostupné v režime súhrnu.',
      modeLabel: 'Režim',
      windowLabel: 'Okno',
      rankingLabel: 'Rebríček',
      topPrefix: 'Top',
      metricFallback: 'Metrika',
      liveRanking: 'Živý rebríček',
      bannerError: 'Nepodarilo sa načítať globálne dáta.',
      allTime: 'Celé obdobie',
      daySnapshot: 'Snímka dňa',
      rangeWindow: 'Obdobie',
      allTimeMode: 'Za celé obdobie',
      countries: 'krajín',
      continents: 'kontinentov',
      noCountriesYet: 'Zatiaľ žiadne krajiny',
      noContinentsYet: 'Zatiaľ žiadne kontinenty',
    },
    about: {
      eyebrow: 'O projekte',
      title: 'O COVID 3D Atlas (OWID / WHO / Worldometer)',
      lede:
        'Táto stránka sumarizuje kontext verejného reportovania prípadov COVID-19 z Our World in Data, WHO Dashboard a Worldometer, skontrolovaný k 10. marcu 2026.',
      highlightsLabel: 'Hlavné body projektu',
      highlights: [
        {
          kicker: 'Interpretácia OWID',
          title: 'Potvrdené prípady vs. skutočné infekcie',
          body:
            'OWID uvádza, že potvrdené prípady predstavujú infekcie potvrdené testom, zatiaľ čo skutočný počet infekcií je zvyčajne vyšší, pretože testovanie nie je úplné a reportovanie sa oneskoruje.',
        },
        {
          kicker: 'Formát reportovania WHO',
          title: 'Logika týždenného dashboardu',
          body:
            'WHO vysvetľuje, že krajiny teraz reportujú s rôznou frekvenciou. Od 25. augusta 2023 WHO posilnila dôraz na týždenné reportovanie a dashboard uprednostňuje týždenné indikátory, aby sa znížila nesprávna interpretácia riedkych denných dát.',
        },
        {
          kicker: 'Stav Worldometer',
          title: 'Iba historický prístup',
          body:
            'Worldometer uvádza, že 13. apríla 2024 prestal aktualizovať COVID tracker z dôvodu obmedzenej možnosti udržiavať štatisticky validné globálne live súhrny, no historické dáta zostávajú dostupné.',
        },
      ],
      secondary: [
        {
          kicker: 'Pôvod dát',
          title: 'Prepojenie OWID a WHO',
          body:
            'OWID dokumentuje, že jeho vizualizácie potvrdených prípadov a úmrtí vychádzajú z dát WHO a zároveň publikuje súbory CSV/XLSX/JSON aj GitHub prístup pre reprodukovateľnosť.',
        },
        {
          kicker: 'Limity porovnateľnosti',
          title: 'Prečo sa zdroje môžu líšiť',
          body:
            'WHO aj OWID upozorňujú na rozdiely medzi krajinami v definíciách, testovacích stratégiách a oneskoreniach reportovania. WHO zároveň uvádza, že retrospektívne opravy môžu vytvoriť špičky alebo dokonca záporné týždenné hodnoty.',
        },
      ],
      sourcesKicker: 'Zdroje',
      sourcesTitle: 'Stránky použité v tejto sekcii',
      disclaimerKicker: 'Upozornenie',
      disclaimerTitle: 'Informačný účel',
      disclaimerBody:
        'Tento dashboard má informačný charakter a sumarizuje reportované údaje o prípadoch. Nejde o diagnostický ani klinický nástroj.',
    },
    faq: {
      eyebrow: 'Centrum pomoci',
      title: 'Často kladené otázky',
      lede:
        'Tieto odpovede sumarizujú kontext reportovania OWID, WHO Dashboard a Worldometer a zároveň vysvetľujú, ako tento dashboard zobrazuje dostupné údaje.',
      listLabel: 'Zoznam otázok',
      items: [
        {
          question: 'Prečo môžu OWID, WHO a Worldometer zobrazovať odlišné čísla?',
          answer:
            'Zdroje používajú rozdielne reportovacie pipeline, časy aktualizácie a národné podania. WHO aj OWID upozorňujú, že testovanie a reportovanie sa medzi krajinami líši, čo ovplyvňuje porovnateľnosť.',
        },
        {
          question: 'Publikuje WHO stále denné globálne počty prípadov?',
          answer:
            'Komunikácia WHO v dashboarde zdôrazňuje týždenné reportovanie a interpretáciu trendov. WHO tiež uvádza, že krajiny reportujú s rôznou frekvenciou, takže denná interpretácia môže byť zavádzajúca.',
        },
        {
          question: 'Čo sa zmenilo 25. augusta 2023 v odporúčaniach WHO pre reportovanie?',
          answer:
            'WHO požiadala krajiny, aby od 25. augusta 2023 pokračovali v kvalitnom týždennom reportovaní, a presunula dôraz dashboardu na týždenné indikátory podľa aktuálnej kvality dát.',
        },
        {
          question: 'Prečo môžu týždenné dáta niekedy obsahovať záporné hodnoty?',
          answer:
            'WHO vysvetľuje, že retrospektívne čistenie dát a reklasifikácia záznamov zo strany krajín môžu vytvoriť viditeľné záporné korekcie v jednotlivých týždňoch.',
        },
        {
          question: 'Aktualizuje Worldometer ešte stále denné COVID súhrny?',
          answer:
            'Podľa vlastného oznámenia Worldometer prestal aktualizovať COVID tracker 13. apríla 2024, no historické dáta a archívy zostávajú dostupné.',
        },
        {
          question: 'Čo OWID myslí pod pojmom potvrdené prípady?',
          answer:
            'OWID definuje potvrdené prípady ako infekcie potvrdené testom. Zároveň uvádza, že potvrdené počty sú nižšie než skutočný počet infekcií, pretože nie každý je testovaný.',
        },
        {
          question: 'Odkiaľ OWID berie dáta o prípadoch?',
          answer:
            'Dokumentácia OWID na stránke o prípadoch uvádza, že ich dataset potvrdených prípadov a úmrtí vychádza z reportovania WHO.',
        },
        {
          question: 'Prečo môže tento dashboard zobrazovať chýbajúce dáta pre niektoré miesta alebo dátumy?',
          answer:
            'Stav „bez dát“ sa zobrazí, keď hodnota pre zvolenú metriku alebo dátový režim chýba v ingestovanom datasete, alebo keď má zdroj v danom období medzery v reportovaní.',
        },
        {
          question: 'Kde si môžem priamo overiť metodiku zdrojov?',
          answer:
            'Otvorte odkazy na stránke „O projekte“: dokumentáciu OWID k prípadom, stránku dashboardu WHO a stránky tracker/about od Worldometer.',
        },
      ],
    },
  },
} as const;

export type AppCopy = (typeof appCopy)[LocaleCode];
