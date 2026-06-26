import { cn } from '@/lib/utils';

export function Section({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('w-full px-4 sm:px-11 py-16 lg:py-28', className)}>{children}</section>
  );
}
