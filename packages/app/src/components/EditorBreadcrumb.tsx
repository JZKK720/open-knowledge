import { MoreHorizontalIcon } from 'lucide-react';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { tabParts } from '@/editor/editor-tabs';
import { cn } from '@/lib/utils';

interface EditorBreadcrumbProps {
  docName: string | null;
  className?: string;
}

const LEADING_VISIBLE = 1;
const TRAILING_VISIBLE = 2;
const COLLAPSE_THRESHOLD = 4;

type BreadcrumbNode =
  | { kind: 'segment'; value: string; key: string }
  | { kind: 'ellipsis'; hidden: readonly string[] };

export function EditorBreadcrumb({ docName, className }: EditorBreadcrumbProps) {
  if (!docName) return null;
  const { prefix } = tabParts(docName, '');
  if (!prefix) return null;
  const segments = prefix.replace(/\/$/, '').split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const segmentNode = (value: string, absoluteIndex: number): BreadcrumbNode => ({
    kind: 'segment',
    value,
    key: segments.slice(0, absoluteIndex + 1).join('/'),
  });

  const collapsed = segments.length > COLLAPSE_THRESHOLD;
  const nodes: BreadcrumbNode[] = collapsed
    ? [
        ...segments.slice(0, LEADING_VISIBLE).map((value, i) => segmentNode(value, i)),
        { kind: 'ellipsis', hidden: segments.slice(LEADING_VISIBLE, -TRAILING_VISIBLE) },
        ...segments
          .slice(-TRAILING_VISIBLE)
          .map((value, i) => segmentNode(value, segments.length - TRAILING_VISIBLE + i)),
      ]
    : segments.map((value, i) => segmentNode(value, i));

  return (
    <Breadcrumb className={cn('flex min-w-0 items-center', className)}>
      <BreadcrumbList className="min-w-0 flex-nowrap gap-1 overflow-hidden text-muted-foreground/70 text-xs">
        {nodes.map((node, index) => {
          const key = node.kind === 'segment' ? node.key : 'ellipsis';
          return (
            <Fragment key={key}>
              {/* Separator is a SIBLING of the item — shadcn renders both as
                  <li>, so nesting a separator inside an item would produce
                  invalid <li><li>...</li></li> HTML. shrink-0 keeps the chevron
                  from being squeezed away when segments truncate. */}
              {index > 0 && (
                <BreadcrumbSeparator className="shrink-0 text-muted-foreground/70 [&>svg]:size-3" />
              )}
              {node.kind === 'ellipsis' ? (
                <BreadcrumbItem className="shrink-0">
                  <span
                    aria-hidden="true"
                    title={node.hidden.join(' / ')}
                    className="flex size-4 items-center justify-center text-muted-foreground/70"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </span>
                  {/* Keep the collapsed segments in the a11y reading order. */}
                  <span className="sr-only">{node.hidden.join(' / ')}</span>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage
                    current={false}
                    className="min-w-0 truncate font-normal text-muted-foreground/70"
                    title={node.value}
                  >
                    {node.value}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
