import React, { ElementType } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title = 'No data available', message = 'Data will appear here once synchronized.', icon: Icon = Inbox }: { title?: string; message?: string; icon?: ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="w-16 h-16 text-text-muted mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary max-w-md">{message}</p>
    </div>
  );
}
