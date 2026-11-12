import { getSurfaceColor } from '../utils/format';

export function SurfaceBadge({ surface }: { surface: string | null | undefined }) {
  if (!surface) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-badge text-xs font-medium ${getSurfaceColor(surface)}`}>
      {surface}
    </span>
  );
}
