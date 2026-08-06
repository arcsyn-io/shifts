import { Alert, Button, Card } from '@arcsyn-io/react';

interface SessionUnavailableProps {
  onRetry: () => void;
  isRetrying: boolean;
}

export function SessionUnavailable({ onRetry, isRetrying }: SessionUnavailableProps) {
  return (
    <main className="session-state" data-arcsyn-theme="dark">
      <Card className="session-state__card">
        <Alert
          variant="danger"
          title="We couldn't verify your session"
          description="The authentication service is temporarily unavailable. Your session has not been changed."
        />
        <Button type="button" onClick={onRetry} loading={isRetrying}>
          Try again
        </Button>
      </Card>
    </main>
  );
}
