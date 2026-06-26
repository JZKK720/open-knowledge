import { cn } from '@/lib/utils';

const Tag = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <span
      className={cn(
        'text-base text-primary font-mono font-medium uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  );
};

const Description = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <p className={cn('text-xl leading-snug text-slide-muted', className)}>{children}</p>;
};

interface SectionHeadingProps {
  children: React.ReactNode;
  tag?: string;
  className?: string;
  description?: string;
  headingClassName?: string;
  tagClassName?: string;
  descriptionClassName?: string;
}

const SectionHeading = ({
  children,
  tag,
  description,
  className,
  headingClassName,
  tagClassName,
  descriptionClassName,
}: SectionHeadingProps) => {
  return (
    <div className={cn('flex items-left gap-3 flex-col', className)}>
      {tag && <Tag className={tagClassName}>{tag}</Tag>}
      <h2
        className={cn(
          'text-4xl font-light leading-tight tracking-tight text-slide-text sm:text-5xl',
          headingClassName,
        )}
      >
        {children}
      </h2>
      {description && <Description className={descriptionClassName}>{description}</Description>}
    </div>
  );
};

export default SectionHeading;
