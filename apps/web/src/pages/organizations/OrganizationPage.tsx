import { organizationSlugSchema } from '@arcsyn-shift/contracts';
import { DataState } from '@arcsyn-io/react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { OrganizationWorkspace } from '@/features/organizations';
import { ApplicationShell } from '@/pages/layouts/ApplicationShell';

export function OrganizationPage() {
  const { t } = useTranslation('organizations');
  const params = useParams<{ slug: string }>();
  const parsedSlug = organizationSlugSchema.safeParse(params.slug);
  const contextTitle = parsedSlug.success ? parsedSlug.data : t('workspace.fallbackTitle');

  return (
    <ApplicationShell activeArea="organization" contextTitle={contextTitle}>
      <main className="organization-page">
        {parsedSlug.success ? (
          <OrganizationWorkspace slug={parsedSlug.data} />
        ) : (
          <div className="organization-route-state" data-status="404">
            <DataState
              state="error"
              size="full"
              title={t('states.organizationUnavailableTitle')}
              description={t('states.organizationUnavailableDescription')}
              action={
                <Link className="organization-link-button" to="/">
                  {t('actions.returnHome')}
                </Link>
              }
            />
          </div>
        )}
      </main>
    </ApplicationShell>
  );
}
