import {
  createOrganizationRequestSchema,
  type CreateOrganizationRequest,
  type OrganizationRole,
} from '@arcsyn-shift/contracts';
import { Alert, Badge, Button, Card, DataState, Field, Input } from '@arcsyn-io/react';
import { OrganizationIcon, PlusIcon } from '@arcsyn-io/react/icons';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  useAcceptOrganizationInvitationMutation,
  useCreateOrganizationMutation,
} from '@/features/organizations/mutations/organizations';
import {
  useOrganizationInvitationsQuery,
  useOrganizationsQuery,
} from '@/features/organizations/queries/organizations';

function roleVariant(role: OrganizationRole): 'accent' | 'neutral' | 'success' {
  if (role === 'owner') return 'accent';
  if (role === 'admin') return 'success';
  return 'neutral';
}

export function OrganizationHome() {
  const { t, i18n } = useTranslation('organizations');
  const navigate = useNavigate();
  const organizations = useOrganizationsQuery();
  const invitations = useOrganizationInvitationsQuery();
  const createMutation = useCreateOrganizationMutation();
  const acceptMutation = useAcceptOrganizationInvitationMutation();
  const createErrorRef = useRef<HTMLDivElement>(null);
  const acceptErrorRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateOrganizationRequest>({ defaultValues: { name: '', slug: '' } });

  useEffect(() => {
    if (createMutation.isError) createErrorRef.current?.focus();
  }, [createMutation.isError]);

  useEffect(() => {
    if (acceptMutation.isError) acceptErrorRef.current?.focus();
  }, [acceptMutation.isError]);

  const submitOrganization = handleSubmit(async (values) => {
    createMutation.reset();
    const parsed = createOrganizationRequestSchema.safeParse(values);

    if (!parsed.success) {
      let firstInvalidField: keyof CreateOrganizationRequest | undefined;
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' || field === 'slug') {
          firstInvalidField ??= field;
          setError(field, { type: 'validate' });
        }
      }
      if (firstInvalidField) setFocus(firstInvalidField);
      return;
    }

    const organization = await createMutation.mutateAsync(parsed.data).catch(() => undefined);
    if (!organization) return;

    reset();
    navigate(`/organizations/${organization.slug}`);
  });

  const acceptInvitation = async (invitationId: string) => {
    acceptMutation.reset();
    const organization = await acceptMutation.mutateAsync(invitationId).catch(() => undefined);
    if (organization) navigate(`/organizations/${organization.slug}`);
  };

  return (
    <div className="organizations-home">
      <section className="organizations-section" aria-labelledby="organizations-list-title">
        <div className="organizations-section__heading">
          <div>
            <p>{t('home.organizations.eyebrow')}</p>
            <h2 id="organizations-list-title">{t('home.organizations.title')}</h2>
          </div>
          {organizations.data ? (
            <Badge variant="neutral">
              {t('home.organizations.count', { count: organizations.data.organizations.length })}
            </Badge>
          ) : null}
        </div>

        {organizations.isPending ? (
          <DataState
            state="loading"
            loadingLabel={t('states.loadingOrganizations')}
            skeletonCount={3}
          />
        ) : organizations.isError ? (
          <DataState
            state="error"
            title={t('states.organizationsErrorTitle')}
            description={t('states.organizationsErrorDescription')}
            action={
              <Button
                type="button"
                variant="outline"
                loading={organizations.isFetching}
                onClick={() => void organizations.refetch()}
              >
                {t('actions.retry')}
              </Button>
            }
          />
        ) : organizations.data.organizations.length === 0 ? (
          <DataState
            state="empty"
            title={t('states.organizationsEmptyTitle')}
            description={t('states.organizationsEmptyDescription')}
            icon={<OrganizationIcon aria-hidden="true" size={22} />}
          />
        ) : (
          <ul className="organization-card-grid">
            {organizations.data.organizations.map((organization) => (
              <li key={organization.id}>
                <Link className="organization-card-link" to={`/organizations/${organization.slug}`}>
                  <Card interactive className="organization-card">
                    <Card.Content className="organization-card__content">
                      <span className="organization-card__icon" aria-hidden="true">
                        <OrganizationIcon size={20} />
                      </span>
                      <div className="organization-card__copy">
                        <Card.Title as="h3">{organization.name}</Card.Title>
                        <Card.Description>/{organization.slug}</Card.Description>
                      </div>
                      <Badge variant={roleVariant(organization.role)}>
                        {t(`roles.${organization.role}`)}
                      </Badge>
                    </Card.Content>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="organizations-section" aria-labelledby="invitations-title">
        <div className="organizations-section__heading">
          <div>
            <p>{t('home.invitations.eyebrow')}</p>
            <h2 id="invitations-title">{t('home.invitations.title')}</h2>
          </div>
        </div>

        {acceptMutation.isError ? (
          <div ref={acceptErrorRef} tabIndex={-1} className="organization-alert-focus">
            <Alert
              role="alert"
              variant="danger"
              title={t('states.acceptErrorTitle')}
              description={t('states.acceptErrorDescription')}
            />
          </div>
        ) : null}

        {invitations.isPending ? (
          <DataState
            state="loading"
            loadingLabel={t('states.loadingInvitations')}
            skeletonCount={2}
          />
        ) : invitations.isError ? (
          <DataState
            state="error"
            title={t('states.invitationsErrorTitle')}
            description={t('states.invitationsErrorDescription')}
            action={
              <Button
                type="button"
                variant="outline"
                loading={invitations.isFetching}
                onClick={() => void invitations.refetch()}
              >
                {t('actions.retry')}
              </Button>
            }
          />
        ) : invitations.data.invitations.length === 0 ? (
          <DataState
            state="empty"
            size="compact"
            title={t('states.invitationsEmptyTitle')}
            description={t('states.invitationsEmptyDescription')}
          />
        ) : (
          <ul className="invitation-list">
            {invitations.data.invitations.map((invitation) => (
              <li key={invitation.id}>
                <Card className="invitation-card">
                  <Card.Content className="invitation-card__content">
                    <div>
                      <Card.Title as="h3">{invitation.organization.name}</Card.Title>
                      <Card.Description>
                        {t('home.invitations.expires', {
                          date: new Intl.DateTimeFormat(i18n.language, {
                            dateStyle: 'medium',
                          }).format(new Date(invitation.expiresAt)),
                        })}
                      </Card.Description>
                    </div>
                    <div className="invitation-card__actions">
                      <Badge variant={roleVariant(invitation.role)}>
                        {t(`roles.${invitation.role}`)}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        loading={
                          acceptMutation.isPending && acceptMutation.variables === invitation.id
                        }
                        disabled={acceptMutation.isPending}
                        onClick={() => void acceptInvitation(invitation.id)}
                      >
                        {t('actions.acceptInvitation')}
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="organizations-section" aria-labelledby="create-organization-title">
        <Card className="organization-create-card">
          <Card.Header>
            <Card.Eyebrow>{t('home.create.eyebrow')}</Card.Eyebrow>
            <Card.Title id="create-organization-title">{t('home.create.title')}</Card.Title>
            <Card.Description>{t('home.create.description')}</Card.Description>
          </Card.Header>
          <Card.Content>
            {createMutation.isError ? (
              <div ref={createErrorRef} tabIndex={-1} className="organization-alert-focus">
                <Alert
                  role="alert"
                  variant="danger"
                  title={t('states.createErrorTitle')}
                  description={t('states.createErrorDescription')}
                />
              </div>
            ) : null}
            <form className="organization-form" onSubmit={submitOrganization} noValidate>
              <Field.Root>
                <Field.Label htmlFor="organization-name">{t('fields.nameLabel')}</Field.Label>
                <Input
                  {...register('name')}
                  id="organization-name"
                  autoComplete="organization"
                  maxLength={80}
                  invalid={Boolean(errors.name)}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'organization-name-error' : undefined}
                  disabled={createMutation.isPending}
                />
                {errors.name ? (
                  <Field.Error id="organization-name-error">{t('fields.nameError')}</Field.Error>
                ) : null}
              </Field.Root>
              <Field.Root>
                <Field.Label htmlFor="organization-slug">{t('fields.slugLabel')}</Field.Label>
                <Input
                  {...register('slug')}
                  id="organization-slug"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={39}
                  placeholder={t('fields.slugPlaceholder')}
                  invalid={Boolean(errors.slug)}
                  aria-invalid={Boolean(errors.slug)}
                  aria-describedby="organization-slug-description organization-slug-error"
                  disabled={createMutation.isPending}
                />
                <Field.Description id="organization-slug-description">
                  {t('fields.slugDescription')}
                </Field.Description>
                {errors.slug ? (
                  <Field.Error id="organization-slug-error">{t('fields.slugError')}</Field.Error>
                ) : null}
              </Field.Root>
              <Button
                type="submit"
                leadingIcon={<PlusIcon aria-hidden="true" size={16} />}
                loading={createMutation.isPending}
              >
                {t('actions.createOrganization')}
              </Button>
            </form>
          </Card.Content>
        </Card>
      </section>
    </div>
  );
}
