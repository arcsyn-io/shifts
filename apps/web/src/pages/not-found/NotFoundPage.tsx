import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main>
      <h1>Something went wrong.</h1>
      <Link to="/">Return home</Link>
    </main>
  );
}
