export type Loggable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Loggable[]
  | { [key: string]: Loggable };

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
] as const satisfies readonly LogLevel[];

export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
  readonly cause?: SerializedError | SerializedErrorTruncation;
}

export interface SerializedErrorTruncation {
  readonly name: 'SerializedError.CauseDepthExceeded' | 'SerializedError.CauseCycle';
  readonly message: string;
}

export type ClassifiedPath = string & { readonly __brand: 'ClassifiedPath' };

export interface LogPayload {
  readonly [key: string]: Loggable;
}

export interface BundleRedaction {
  readonly file: string;
  readonly lineCount: number;
  readonly patterns: string[];
}

export interface BundleManifest {
  readonly generatedAt: string;
  readonly disciplineVersion: string;
  readonly projectSlug: string | null;
  readonly files: string[];
  readonly redactions: BundleRedaction[];
  readonly sysinfo: Record<string, Loggable>;
}
