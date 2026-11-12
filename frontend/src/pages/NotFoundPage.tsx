import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl font-extrabold text-accent mb-4">404</div>
      <h1 className="text-2xl font-bold text-text-primary mb-2">Page Not Found</h1>
      <p className="text-text-secondary max-w-md mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="inline-flex items-center gap-2 bg-accent text-surface font-semibold px-6 py-3 rounded-badge hover:bg-accent-hover transition-colors">
        <Home size={20} /> Back to Home
      </Link>
    </div>
  );
}
