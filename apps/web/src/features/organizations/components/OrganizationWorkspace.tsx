import {
  createOrganizationInvitationRequestSchema,
  type CreateOrganizationInvitationRequest,
  type OrganizationMember,
  type OrganizationRole,
} from '@arcsyn-shift/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataState,
  Field,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '@arcsyn-io/react';
import { DeleteIcon, PlusIcon, TeamIcon } from '@arcsyn-io/react/icons';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useSessionQuery } from '@/features/auth';
import { OrganizationRequestError } from '@/features/organizations/api/organizations';
import {
  useCreateOrganizationInvitationMutation,
  useRevokeOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
} from '@/features/organizations/mutations/organizations';
import {
  useOrganizationMembersQuery,
  useOrganizationQuery,
} from '@/features/organizations/queries/organizations';

interface OrganizationWorkspaceProps {
  slug: string;
}

const organizationRoles: OrganizationRole[] = ['owner', 'admin', 'member'];

function roleVariant(role: OrganizationRole): 'accent' | 'neutral' | 'success' {
  if (role === 'owner') return 'accent';
  if (role === 'admin') return 'success';
  return 'neutral';
}

function availableInvitationRoles(role: OrganizationRole): OrganizationRole[] {
  if (role === 'owner') return organizationRoles;
  if (role === 'admin') return ['member'];
  return [];
}

function canRevokeMember(
  actorRole: OrganizationRole,
  member: OrganizationMember,
  currentUserId: string | undefined,
): boolean {
  if (member.userId === currentUserId) return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && member.role === 'member';
}

export function OrganizationWorkspace({ slug }: OrganizationWorkspaceProps) {
  const { t } = useTranslation('organizations');
  const organization = useOrganizationQuery(slug);

  if (organization.isPending) {
    return (
      <DataState
        className="organization-route-state"
        state="loading"
        size="full"
        loadingLabel={t('states.loadingOrganization')}
        skeletonCount={4}
      />
    );
  }

  if (organization.isError) {
    const status =
      organization.error instanceof OrganizationRequestError ? organization.error.status : 0;
    const accessDenied = status === 403;
    const concealed = status === 403 || status === 404;

    return (
      <div className="organization-route-state" data-status={status || 'error'}>
        <DataState
          state={accessDenied ? 'permission' : 'error'}
          size="full"
          title={
            concealed
              ? t('states.organizationUnavailableTitle')
              : t('states.organizationErrorTitle')
          }
          description={
            concealed
              ? t('states.organizationUnavailableDescription')
              : t('states.organizationErrorDescription')
          }
          action={
            concealed ? (
              <Link className="organization-link-button" to="/">
                {t('actions.returnHome')}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                loading={organization.isFetching}
                onClick={() => void organization.refetch()}
              >
                {t('actions.retry')}
              </Button>
            )
          }
        />
      </div>
    );
  }

  return <OrganizationEnvironment organization={organization.data} />;
}

interface OrganizationEnvironmentProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    role: OrganizationRole;
  };
}

function OrganizationEnvironment({ organization }: OrganizationEnvironmentProps) {
  const { t } = useTranslation('organizations');
  const session = useSessionQuery();
  const members = useOrganizationMembersQuery(organization.slug);
  const inviteMutation = useCreateOrganizationInvitationMutation(organization.slug);
  const updateMemberMutation = useUpdateOrganizationMemberMutation(organization.slug);
  const revokeMemberMutation = useRevokeOrganizationMemberMutation(organization.slug);
  const mutationErrorRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<CreateOrganizationInvitationRequest>({
    defaultValues: { email: '', role: 'member' },
  });
  const invitationRoles = availableInvitationRoles(organization.role);
  const mutationHasError =
    inviteMutation.isError || updateMemberMutation.isError || revokeMemberMutation.isError;

  useEffect(() => {
    if (mutationHasError) mutationErrorRef.current?.focus();
  }, [mutationHasError]);

  const submitInvitation = handleSubmit(async (values) => {
    inviteMutation.reset();
    const parsed = createOrganizationInvitationRequestSchema.safeParse(values);

    if (!parsed.success || !invitationRoles.includes(values.role)) {
      let firstInvalidField: 'email' | 'role' | undefined;
      const issues = parsed.success ? [{ path: ['role'] }] : parsed.error.issues;
      for (const issue of issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'role') {
          firstInvalidField ??= field;
          setError(field, { type: 'validate' });
        }
      }
      if (firstInvalidField) setFocus(firstInvalidField);
      return;
    }

    const invitation = await inviteMutation.mutateAsync(parsed.data).catch(() => undefined);
    if (invitation) reset({ email: '', role: 'member' });
  });

  const changeMemberRole = (member: OrganizationMember, role: OrganizationRole) => {
    updateMemberMutation.reset();
    if (role === member.role) return;
    void updateMemberMutation.mutateAsync({ userId: member.userId, input: { role } }).catch(() => {
      // A nova leitura após retry mantém a fonte remota como autoridade.
    });
  };

  const revokeMember = (member: OrganizationMember) => {
    revokeMemberMutation.reset();
    if (!window.confirm(t('members.revokeConfirmation', { email: member.email }))) return;
    void revokeMemberMutation.mutateAsync(member.userId).catch(() => {
      // O vínculo permanece visível quando a API rejeita a operação.
    });
  };

  const mutationError =
    inviteMutation.error ?? updateMemberMutation.error ?? revokeMemberMutation.error;
  const invitationConflict =
    mutationError instanceof OrganizationRequestError &&
    mutationError.code === 'ORGANIZATION_CONFLICT';

  return (
    <div className="organization-workspace">
      <header className="organization-workspace__header">
        <div>
          <p className="organization-workspace__eyebrow">{t('workspace.eyebrow')}</p>
          <h1>{organization.name}</h1>
          <p>{t('workspace.description', { slug: organization.slug })}</p>
        </div>
        <Badge variant={roleVariant(organization.role)}>{t(`roles.${organization.role}`)}</Badge>
      </header>

      {mutationHasError ? (
        <div ref={mutationErrorRef} tabIndex={-1} className="organization-alert-focus">
          <Alert
            role="alert"
            variant="danger"
            title={t('states.mutationErrorTitle')}
            description={
              invitationConflict
                ? t('states.invitationConflictDescription')
                : t('states.mutationErrorDescription')
            }
          />
        </div>
      ) : null}

      {inviteMutation.isSuccess ? (
        <Alert
          role="status"
          variant="success"
          title={t('states.invitationSuccessTitle')}
          description={t('states.invitationSuccessDescription')}
        />
      ) : null}

      {invitationRoles.length > 0 ? (
        <Card className="organization-invite-card">
          <Card.Header>
            <Card.Title>{t('invite.title')}</Card.Title>
            <Card.Description>{t('invite.description')}</Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="organization-invite-form" onSubmit={submitInvitation} noValidate>
              <Field.Root>
                <Field.Label htmlFor="invitation-email">{t('fields.emailLabel')}</Field.Label>
                <Input
                  {...register('email')}
                  id="invitation-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={320}
                  invalid={Boolean(errors.email)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'invitation-email-error' : undefined}
                  disabled={inviteMutation.isPending}
                />
                {errors.email ? (
                  <Field.Error id="invitation-email-error">{t('fields.emailError')}</Field.Error>
                ) : null}
              </Field.Root>
              <Field.Root>
                <Field.Label htmlFor="invitation-role">{t('fields.roleLabel')}</Field.Label>
                <NativeSelect
                  {...register('role')}
                  id="invitation-role"
                  invalid={Boolean(errors.role)}
                  aria-invalid={Boolean(errors.role)}
                  aria-describedby={errors.role ? 'invitation-role-error' : undefined}
                  disabled={inviteMutation.isPending}
                >
                  {invitationRoles.map((role) => (
                    <NativeSelectOption key={role} value={role}>
                      {t(`roles.${role}`)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.role ? (
                  <Field.Error id="invitation-role-error">{t('fields.roleError')}</Field.Error>
                ) : null}
              </Field.Root>
              <Button
                type="submit"
                leadingIcon={<PlusIcon aria-hidden="true" size={16} />}
                loading={inviteMutation.isPending}
              >
                {t('actions.sendInvitation')}
              </Button>
            </form>
          </Card.Content>
        </Card>
      ) : null}

      <section className="organization-members" aria-labelledby="organization-members-title">
        <div className="organizations-section__heading">
          <div>
            <p>{t('members.eyebrow')}</p>
            <h2 id="organization-members-title">{t('members.title')}</h2>
          </div>
          {members.data ? (
            <Badge variant="neutral">
              {t('members.count', { count: members.data.members.length })}
            </Badge>
          ) : null}
        </div>

        {members.isPending ? (
          <DataState state="loading" loadingLabel={t('states.loadingMembers')} skeletonCount={4} />
        ) : members.isError ? (
          <DataState
            state="error"
            title={t('states.membersErrorTitle')}
            description={t('states.membersErrorDescription')}
            action={
              <Button
                type="button"
                variant="outline"
                loading={members.isFetching}
                onClick={() => void members.refetch()}
              >
                {t('actions.retry')}
              </Button>
            }
          />
        ) : members.data.members.length === 0 ? (
          <DataState
            state="empty"
            title={t('states.membersEmptyTitle')}
            description={t('states.membersEmptyDescription')}
            icon={<TeamIcon aria-hidden="true" size={22} />}
          />
        ) : (
          <ul className="member-list">
            {members.data.members.map((member) => {
              const isUpdating =
                updateMemberMutation.isPending &&
                updateMemberMutation.variables?.userId === member.userId;
              const isRevoking =
                revokeMemberMutation.isPending && revokeMemberMutation.variables === member.userId;
              const canRevoke = canRevokeMember(
                organization.role,
                member,
                session.data?.principal.id,
              );

              return (
                <li key={member.userId}>
                  <Card className="member-card">
                    <Card.Content className="member-card__content">
                      <div className="member-card__identity">
                        <strong>{member.email}</strong>
                        {member.userId === session.data?.principal.id ? (
                          <span>{t('members.you')}</span>
                        ) : null}
                      </div>
                      <div className="member-card__actions">
                        {organization.role === 'owner' ? (
                          <NativeSelect
                            aria-label={t('members.changeRoleLabel', { email: member.email })}
                            value={member.role}
                            disabled={isUpdating || revokeMemberMutation.isPending}
                            onChange={(event) =>
                              changeMemberRole(member, event.target.value as OrganizationRole)
                            }
                          >
                            {organizationRoles.map((role) => (
                              <NativeSelectOption key={role} value={role}>
                                {t(`roles.${role}`)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        ) : (
                          <Badge variant={roleVariant(member.role)}>
                            {t(`roles.${member.role}`)}
                          </Badge>
                        )}
                        {canRevoke ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            leadingIcon={<DeleteIcon aria-hidden="true" size={15} />}
                            loading={isRevoking}
                            disabled={
                              updateMemberMutation.isPending || revokeMemberMutation.isPending
                            }
                            onClick={() => revokeMember(member)}
                          >
                            {t('actions.revoke')}
                          </Button>
                        ) : null}
                      </div>
                    </Card.Content>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
