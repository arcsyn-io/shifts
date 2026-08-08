import { NativeSelect, NativeSelectOption } from '@arcsyn-io/react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLocale, isSupportedLocale, resolveLocale } from '@/shared/i18n/i18n';

interface LocaleSwitcherProps {
  className?: string;
  id?: string;
}

export function LocaleSwitcher({ className, id }: LocaleSwitcherProps) {
  const { i18n, t } = useTranslation('common');
  const locale = resolveLocale(i18n.resolvedLanguage);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = event.target.value;
    if (isSupportedLocale(nextLocale)) void changeLocale(nextLocale);
  };

  return (
    <NativeSelect
      className={className}
      id={id}
      wrapperClassName="locale-switcher"
      size="sm"
      value={locale}
      onChange={handleChange}
      aria-label={t('language.label')}
    >
      <NativeSelectOption value="pt-BR">{t('language.portuguese')}</NativeSelectOption>
      <NativeSelectOption value="en">{t('language.english')}</NativeSelectOption>
    </NativeSelect>
  );
}
