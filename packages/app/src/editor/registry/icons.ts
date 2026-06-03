import {
  AppWindow,
  Box,
  ChevronRight,
  CopyPlus,
  FileText,
  Film,
  GitBranch,
  Image,
  LayoutPanelTop,
  type LucideIcon,
  MessageSquareWarning,
  PanelTop,
  Paperclip,
  Sigma,
  SquarePlay,
  Volume2,
  Workflow,
  ZoomIn,
} from 'lucide-react';

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  AppWindow,
  ChevronRight,
  CopyPlus,
  FileText,
  Film,
  GitBranch,
  Image,
  LayoutPanelTop,
  MessageSquareWarning,
  PanelTop,
  Paperclip,
  Sigma,
  SquarePlay,
  Volume2,
  Workflow,
  ZoomIn,
};

export function resolveIcon(iconName: string | undefined): LucideIcon {
  if (!iconName) return Box;
  return Object.hasOwn(ICON_COMPONENTS, iconName) ? ICON_COMPONENTS[iconName] : Box;
}
