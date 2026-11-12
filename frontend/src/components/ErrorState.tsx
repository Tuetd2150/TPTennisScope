import { AlertTriangle } from 'lucide-react';

export function ErrorState({ message = 'Something went wrong', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="w-16 h-16 text-clay mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">Error</h3>
      <p className="text-text-secondary mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 bg-accent text-surface font-semibold rounded-badge hover:bg-accent-hover transition-colors duration-200">
          Try Again
        </button>
      )}
    </div>
  );
}
