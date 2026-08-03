import { Alert, Button, Card, Field, Input } from '@arcsyn-io/react';
import { loginRequestSchema, type LoginRequest } from '@arcsyn-shift/contracts';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthApiError, login } from '@/features/auth/api/authApi';
import { useAuth } from '@/features/auth/model/AuthProvider';
import { resolveLoginRedirect } from '@/features/auth/model/redirect';

function getLoginErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.status === 400) return 'Check the information entered and try again.';
    if (error.status === 401) return 'Email or password not accepted.';
    if (error.status === 429) return 'Too many attempts. Wait a moment and try again.';
  }

  return 'We could not sign you in. Check your connection and try again.';
}

export function LoginForm() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const form = useForm<LoginRequest>({
    defaultValues: { email: '', password: '' },
  });
  const loginMutation = useMutation({ mutationFn: login });

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors();
    const result = loginRequestSchema.safeParse(values);

    if (!result.success) {
      let firstInvalidField: keyof LoginRequest | undefined;

      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === 'email' || field === 'password') {
          firstInvalidField ??= field;
          form.setError(field, {
            message: field === 'email' ? 'Enter a valid email address.' : 'Enter your password.',
          });
        }
      }
      if (firstInvalidField) form.setFocus(firstInvalidField);
      return;
    }

    try {
      const session = await loginMutation.mutateAsync(result.data);
      auth.setSession(session);
      navigate(resolveLoginRedirect(location.state), { replace: true });
    } catch {
      // The mutation exposes the recoverable error below and keeps form values intact.
    }
  });

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <Card className="login-card">
      <Card.Header>
        <Card.Eyebrow>ArcSyn Shift</Card.Eyebrow>
        <Card.Title>Sign in</Card.Title>
        <Card.Description>Use your provisioned account to continue.</Card.Description>
      </Card.Header>
      <Card.Content>
        <form className="login-form" noValidate onSubmit={submit}>
          {loginMutation.isError ? (
            <Alert
              variant="danger"
              title="Sign-in failed"
              description={getLoginErrorMessage(loginMutation.error)}
              aria-live="polite"
            />
          ) : null}

          <Field.Root>
            <Field.Label htmlFor="email">Email</Field.Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'email-error' : undefined}
              {...form.register('email')}
            />
            {emailError ? <Field.Error id="email-error">{emailError}</Field.Error> : null}
          </Field.Root>

          <Field.Root>
            <Field.Label htmlFor="password">Password</Field.Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'password-error' : undefined}
              {...form.register('password')}
            />
            {passwordError ? <Field.Error id="password-error">{passwordError}</Field.Error> : null}
          </Field.Root>

          <Button
            className="login-form__submit"
            type="submit"
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </Card.Content>
    </Card>
  );
}
