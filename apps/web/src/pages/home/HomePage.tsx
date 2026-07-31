import { HealthStatus } from '@/features/health';

export function HomePage() {
  return (
    <main>
      <p className="eyebrow">ArcSyn Shift</p>
      <h1>Project foundation ready.</h1>
      <p>Initial stack configuration is online. Product rules are intentionally not implemented.</p>
      <HealthStatus />
    </main>
  );
}
