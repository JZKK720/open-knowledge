import { z } from 'zod';
import { FrontmatterPatchSchema } from '../frontmatter/schema.ts';
import { fieldRegistry } from './field-registry.ts';

export const DEFAULT_TELEMETRY_ATTRIBUTE_DENYLIST: readonly string[] = Object.freeze([
  'authorization',
  'auth.token',
  'auth.bearer',
  'cookie',
  'set-cookie',
  'x-api-key',
  'password',
  'secret',
]);

export const DEFAULT_SPANS_MAX_BYTES = 52_428_800;
export const DEFAULT_LOGS_MAX_BYTES = 26_214_400;

export const FolderRuleSchema = z.looseObject({
  match: z
    .string()
    .min(1, "`match` must be a non-empty glob pattern (e.g. 'specs/**' or 'reports/*/**')"),
  frontmatter: FrontmatterPatchSchema,
});

export type FolderRule = z.infer<typeof FolderRuleSchema>;

export const ConfigSchema = z.looseObject({
  content: z
    .looseObject({
      dir: z
        .string()
        .register(fieldRegistry, {
          scope: 'project',
          agentSettable: false,
          defaultScope: 'project',
        })
        .default('.'),
    })
    .default({
      dir: '.',
    }),
  preview: z
    .looseObject({
      scriptSrc: z
        .enum(['cdn-allowlist', 'inline-only'])
        .register(fieldRegistry, {
          scope: 'project',
          agentSettable: false,
          defaultScope: 'project',
        })
        .default('cdn-allowlist'),
    })
    .default({ scriptSrc: 'cdn-allowlist' }),
  appearance: z
    .looseObject({
      theme: z
        .enum(['light', 'dark', 'system'])
        .register(fieldRegistry, {
          scope: 'user',
          agentSettable: false,
          defaultScope: 'user',
        })
        .optional(),
      preview: z
        .looseObject({
          autoOpen: z
            .boolean()
            .register(fieldRegistry, {
              scope: 'user',
              agentSettable: false,
              defaultScope: 'user',
            })
            .default(true),
        })
        .default({ autoOpen: true }),
      sidebar: z
        .looseObject({
          showHiddenFiles: z
            .boolean()
            .register(fieldRegistry, {
              scope: 'project-local',
              agentSettable: false,
              defaultScope: 'project-local',
            })
            .default(false),
          showAllFiles: z
            .boolean()
            .register(fieldRegistry, {
              scope: 'project-local',
              agentSettable: false,
              defaultScope: 'project-local',
            })
            .default(false),
        })
        .optional(),
    })
    .default({ preview: { autoOpen: true } }),
  editor: z
    .looseObject({
      wordWrap: z
        .boolean()
        .register(fieldRegistry, {
          scope: 'user',
          agentSettable: false,
          defaultScope: 'user',
        })
        .default(true),
    })
    .default({ wordWrap: true }),
  autoSync: z
    .looseObject({
      enabled: z
        .boolean()
        .register(fieldRegistry, {
          scope: 'project-local',
          agentSettable: false,
          defaultScope: 'project-local',
        })
        .nullable()
        .default(null),
    })
    .default({ enabled: null }),
  telemetry: z
    .looseObject({
      localSink: z
        .looseObject({
          enabled: z
            .boolean()
            .register(fieldRegistry, {
              scope: 'project',
              agentSettable: false,
              defaultScope: 'project',
            })
            .default(true),
          spans: z
            .looseObject({
              maxBytes: z
                .number()
                .register(fieldRegistry, {
                  scope: 'project',
                  agentSettable: false,
                  defaultScope: 'project',
                })
                .default(DEFAULT_SPANS_MAX_BYTES),
            })
            .default({ maxBytes: DEFAULT_SPANS_MAX_BYTES }),
          logs: z
            .looseObject({
              maxBytes: z
                .number()
                .register(fieldRegistry, {
                  scope: 'project',
                  agentSettable: false,
                  defaultScope: 'project',
                })
                .default(DEFAULT_LOGS_MAX_BYTES),
            })
            .default({ maxBytes: DEFAULT_LOGS_MAX_BYTES }),
          attributeDenylist: z
            .array(z.string())
            .register(fieldRegistry, {
              scope: 'project',
              agentSettable: false,
              defaultScope: 'project',
            })
            .default([...DEFAULT_TELEMETRY_ATTRIBUTE_DENYLIST]),
        })
        .default({
          enabled: true,
          spans: { maxBytes: DEFAULT_SPANS_MAX_BYTES },
          logs: { maxBytes: DEFAULT_LOGS_MAX_BYTES },
          attributeDenylist: [...DEFAULT_TELEMETRY_ATTRIBUTE_DENYLIST],
        }),
    })
    .default({
      localSink: {
        enabled: true,
        spans: { maxBytes: DEFAULT_SPANS_MAX_BYTES },
        logs: { maxBytes: DEFAULT_LOGS_MAX_BYTES },
        attributeDenylist: [...DEFAULT_TELEMETRY_ATTRIBUTE_DENYLIST],
      },
    }),
});

export type Config = z.infer<typeof ConfigSchema>;

export type ConfigPatch = DeepPartial<Config>;

type DeepPartial<T> =
  T extends Array<infer U>
    ? Array<U>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> | null }
      : T;
