import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

const FeatureItem = ({ icon: Icon, title, description, className }: FeatureItemProps) => {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex h-6 w-6 items-center justify-center rounded-md text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-slide-text leading-snug">{title}</h3>
        <p className="text-lg leading-snug text-slide-muted">{description}</p>
      </div>
    </div>
  );
};

export default FeatureItem;
