import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation('notFound');

  return (
    <main>
      <h1>{t('title')}</h1>
      <Link to="/">{t('returnHome')}</Link>
    </main>
  );
}
