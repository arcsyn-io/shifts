import { useQuery } from '@tanstack/react-query';
import { Link, Route, Routes } from 'react-router-dom';

async function fetchHealth() {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error('API unavailable');
  return response.json() as Promise<{ status: string; database: string }>;
}

function Home() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });
  return (
    <main>
      <p className="eyebrow">ArcSyn Shift</p>
      <h1>Project foundation ready.</h1>
      <p>Initial stack configuration is online. Product rules are intentionally not implemented.</p>
      <div className="status">
        API: {health.isPending ? 'checking…' : health.isError ? 'unavailable' : health.data.status}
      </div>
    </main>
  );
}

function ErrorPage() {
  return (
    <main>
      <h1>Something went wrong.</h1>
      <Link to="/">Return home</Link>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  );
}
