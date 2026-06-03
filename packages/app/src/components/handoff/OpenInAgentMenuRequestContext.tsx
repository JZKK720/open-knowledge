import { createContext, type ReactNode, use } from 'react';

interface SelectionHandoffMenuRequest {
  readonly docName: string | null;
  readonly instruction: string;
  readonly selectionMarkdown: string;
}

interface OpenInAgentMenuRequestContextValue {
  readonly openSelection: (request: SelectionHandoffMenuRequest) => boolean;
}

const OpenInAgentMenuRequestContext = createContext<OpenInAgentMenuRequestContextValue | null>(
  null,
);

export function OpenInAgentMenuRequestProvider({
  value,
  children,
}: {
  readonly value: OpenInAgentMenuRequestContextValue;
  readonly children: ReactNode;
}): ReactNode {
  return <OpenInAgentMenuRequestContext value={value}>{children}</OpenInAgentMenuRequestContext>;
}

export function useOpenInAgentMenuRequest(): OpenInAgentMenuRequestContextValue {
  const ctx = use(OpenInAgentMenuRequestContext);
  if (ctx === null) {
    throw new Error(
      'useOpenInAgentMenuRequest must be used within <OpenInAgentMenuRequestProvider />',
    );
  }
  return ctx;
}
