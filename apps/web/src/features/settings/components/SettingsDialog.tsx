import { Dialog, Field, RadioGroup } from '@arcsyn-io/react';
import { SettingsIcon, XIcon } from '@arcsyn-io/react/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocaleSwitcher } from '@/shared/i18n';
import {
  changeTheme,
  isSupportedTheme,
  readPersistedTheme,
  supportedThemes,
  type AppTheme,
} from '@/shared/theme';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themeTranslationKeys = {
  light: 'themes.light',
  dark: 'themes.dark',
  'deep-dark': 'themes.deepDark',
  'corporate-dark': 'themes.corporateDark',
  'catppuccin-mocha': 'themes.catppuccinMocha',
  'catppuccin-latte': 'themes.catppuccinLatte',
} as const satisfies Record<AppTheme, string>;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { t } = useTranslation('settings');
  const [theme, setTheme] = useState(() =>
    readPersistedTheme(typeof window === 'undefined' ? undefined : window.localStorage),
  );

  const selectTheme = (value: string) => {
    if (!isSupportedTheme(value)) return;
    setTheme(value);
    changeTheme(value);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="settings-dialog">
        <Dialog.Header className="settings-dialog__header">
          <div>
            <Dialog.Title>{t('title')}</Dialog.Title>
            <Dialog.Description>{t('description')}</Dialog.Description>
          </div>
          <Dialog.Close
            className="settings-dialog__close"
            variant="ghost"
            size="sm"
            aria-label={t('close')}
          >
            <XIcon aria-hidden="true" size={18} />
          </Dialog.Close>
        </Dialog.Header>

        <div className="settings-dialog__layout">
          <nav className="settings-dialog__navigation" aria-label={t('navigationLabel')}>
            <button className="settings-dialog__navigation-item" type="button" aria-current="page">
              <SettingsIcon aria-hidden="true" size={17} />
              <span>{t('preferences.title')}</span>
            </button>
          </nav>

          <section className="settings-preferences" aria-labelledby="settings-preferences-title">
            <div className="settings-preferences__heading">
              <h2 id="settings-preferences-title">{t('preferences.title')}</h2>
              <p>{t('preferences.description')}</p>
            </div>

            <div className="settings-preference">
              <div className="settings-preference__copy">
                <h3>{t('language.title')}</h3>
                <p>{t('language.description')}</p>
              </div>
              <Field.Root>
                <Field.Label htmlFor="settings-language">{t('language.label')}</Field.Label>
                <LocaleSwitcher id="settings-language" />
              </Field.Root>
            </div>

            <div className="settings-preference settings-preference--themes">
              <div className="settings-preference__copy">
                <h3>{t('appearance.title')}</h3>
                <p>{t('appearance.description')}</p>
              </div>

              <RadioGroup.Root
                className="settings-theme-grid"
                value={theme}
                onValueChange={selectTheme}
                aria-label={t('appearance.label')}
              >
                {supportedThemes.map((option) => (
                  <RadioGroup.Item
                    className="settings-theme-option__control"
                    key={option}
                    value={option}
                    variant="card"
                  >
                    <span className="settings-theme-option__content">
                      <span className="settings-theme-preview" data-arcsyn-theme={option}>
                        <span className="settings-theme-preview__sidebar" />
                        <span className="settings-theme-preview__main">
                          <span className="settings-theme-preview__topbar" />
                          <span className="settings-theme-preview__body">
                            <span className="settings-theme-preview__line" />
                            <span className="settings-theme-preview__card">
                              <span />
                            </span>
                          </span>
                        </span>
                      </span>
                      <span className="settings-theme-option__label">
                        {t(themeTranslationKeys[option])}
                      </span>
                    </span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </div>
          </section>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
