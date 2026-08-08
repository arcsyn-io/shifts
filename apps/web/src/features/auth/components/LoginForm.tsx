import { loginRequestSchema, type LoginRequest } from '@arcsyn-shift/contracts';
import { Alert, Button, Card, Field, Input } from '@arcsyn-io/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AuthRequestError, login } from '@/features/auth/api/auth';
import { ArcSynLogo } from '@/features/auth/components/ArcSynLogo';
import { sessionQueryKey } from '@/features/auth/queries/session';

interface LoginFormProps {
  destination: string;
}

export function LoginForm({ destination }: LoginFormProps) {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LoginRequest>({ defaultValues: { email: '', password: '' } });
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
      navigate(destination, { replace: true });
    },
  });

  useEffect(() => {
    if (loginMutation.isError) errorRef.current?.focus();
  }, [loginMutation.isError]);

  const submit = handleSubmit(async (values) => {
    loginMutation.reset();
    const parsed = loginRequestSchema.safeParse(values);

    if (!parsed.success) {
      let firstInvalidField: 'email' | 'password' | undefined;

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') {
          firstInvalidField ??= field;
          setError(field, {
            type: 'validate',
          });
        }
      }

      if (firstInvalidField) setFocus(firstInvalidField);
      return;
    }

    await loginMutation.mutateAsync(parsed.data).catch(() => undefined);
  });

  const loginError =
    loginMutation.error instanceof AuthRequestError && loginMutation.error.status === 401
      ? t('form.invalidCredentials')
      : t('form.connectionError');

  return (
    <div className="login-panel">
      <Card className="login-card" padding="none">
        <div className="login-card__heading">
          <div className="login-card__brand">
            <ArcSynLogo />
          </div>
          <p className="login-card__eyebrow">{t('form.eyebrow')}</p>
          <h1>{t('form.title')}</h1>
          <p>{t('form.description')}</p>
        </div>

        {loginMutation.isError ? (
          <div ref={errorRef} tabIndex={-1} className="login-card__alert">
            <Alert
              role="alert"
              variant="danger"
              title={t('form.alertTitle')}
              description={loginError}
            />
          </div>
        ) : null}

        <form className="login-form" onSubmit={submit} noValidate>
          <Field.Root>
            <Field.Label htmlFor="email">{t('form.emailLabel')}</Field.Label>
            <Input
              {...register('email')}
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              size="lg"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              aria-invalid={Boolean(errors.email)}
              disabled={loginMutation.isPending}
            />
            {errors.email ? (
              <Field.Error id="email-error">{t('form.invalidEmail')}</Field.Error>
            ) : null}
          </Field.Root>

          <Field.Root>
            <Field.Label htmlFor="password">{t('form.passwordLabel')}</Field.Label>
            <Input
              {...register('password')}
              id="password"
              type="password"
              autoComplete="current-password"
              size="lg"
              invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={Boolean(errors.password)}
              disabled={loginMutation.isPending}
            />
            {errors.password ? (
              <Field.Error id="password-error">{t('form.requiredPassword')}</Field.Error>
            ) : null}
          </Field.Root>

          <Button
            className="login-form__submit"
            type="submit"
            size="lg"
            loading={loginMutation.isPending}
          >
            {t('form.submit')}
          </Button>
        </form>

        <p className="login-card__support">{t('form.support')}</p>
      </Card>
      <p className="login-panel__footer">{t('form.footer')}</p>
    </div>
  );
}
