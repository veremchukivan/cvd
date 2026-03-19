import React from 'react';
import { localeNativeLabel, supportedLocales } from '../lib/i18n';
import { usePreferences } from '../state/preferences';

const SettingsView: React.FC = () => {
  const { theme, setTheme, locale, setLocale, copy } = usePreferences();

  return (
    <div className="page settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{copy.settings.eyebrow}</p>
          <h1 className="title">{copy.settings.title}</h1>
          <p className="lede">{copy.settings.lede}</p>
        </div>
      </header>

      <section className="settings-grid" aria-label={copy.settings.title}>
        <article className="settings-card">
          <p className="panel-kicker">{copy.settings.appearanceKicker}</p>
          <h2 className="card-title">{copy.settings.appearanceTitle}</h2>
          <p className="panel-subtitle">{copy.settings.appearanceSubtitle}</p>
          <div className="settings-option-list">
            <button
              type="button"
              className={`settings-option ${theme === 'obsidian' ? 'settings-option-active' : ''}`}
              onClick={() => setTheme('obsidian')}
              aria-pressed={theme === 'obsidian'}
            >
              <span className="settings-option-title">
                {copy.settings.themeOptions.obsidian.title}
              </span>
              <span className="settings-option-desc">
                {copy.settings.themeOptions.obsidian.description}
              </span>
            </button>
            <button
              type="button"
              className={`settings-option ${theme === 'ivory' ? 'settings-option-active' : ''}`}
              onClick={() => setTheme('ivory')}
              aria-pressed={theme === 'ivory'}
            >
              <span className="settings-option-title">
                {copy.settings.themeOptions.ivory.title}
              </span>
              <span className="settings-option-desc">
                {copy.settings.themeOptions.ivory.description}
              </span>
            </button>
          </div>
        </article>

        <article className="settings-card">
          <p className="panel-kicker">{copy.settings.languageKicker}</p>
          <h2 className="card-title">{copy.settings.languageTitle}</h2>
          <p className="panel-subtitle">{copy.settings.languageSubtitle}</p>
          <div className="settings-option-list">
            {supportedLocales.map((item) => (
              <button
                key={item}
                type="button"
                className={`settings-option ${locale === item ? 'settings-option-active' : ''}`}
                onClick={() => setLocale(item)}
                aria-pressed={locale === item}
              >
                <span className="settings-option-title">{localeNativeLabel(item)}</span>
                <span className="settings-option-desc">
                  {copy.settings.languageOptions[item].description}
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="settings-card settings-card-preview">
          <p className="panel-kicker">{copy.settings.previewKicker}</p>
          <h2 className="card-title">{copy.settings.previewTitle}</h2>
          <p className="panel-subtitle">{copy.settings.previewSubtitle}</p>
          <div className="settings-preview-grid">
            <div className="settings-preview-item">
              <p className="settings-preview-label">{copy.settings.currentTheme}</p>
              <p className="settings-preview-value">
                {theme === 'obsidian'
                  ? copy.settings.themeOptions.obsidian.title
                  : copy.settings.themeOptions.ivory.title}
              </p>
            </div>
            <div className="settings-preview-item">
              <p className="settings-preview-label">{copy.settings.currentLanguage}</p>
              <p className="settings-preview-value">{localeNativeLabel(locale)}</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default SettingsView;
