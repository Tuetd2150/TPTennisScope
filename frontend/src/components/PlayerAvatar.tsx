import { User } from 'lucide-react';
import { useState } from 'react';

export function PlayerAvatar({ name, imagePath, size = 'md' }: { name: string; imagePath?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
  };
  const iconSizes = { sm: 16, md: 20, lg: 32, xl: 48 };

  const apiBase = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || '';
  const imgUrl = imagePath ? `${apiBase}/api/images/players/${imagePath.split('/').pop()}` : null;

  if (imgUrl && !imgError) {
    return (
      <img
        src={imgUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover bg-surface-hover border-2 border-surface-border`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-surface-hover border-2 border-surface-border flex items-center justify-center`}>
      <User size={iconSizes[size]} className="text-text-muted" />
    </div>
  );
}
