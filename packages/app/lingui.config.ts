import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'pseudo'],
  pseudoLocale: 'pseudo',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
      exclude: ['**/node_modules/**', '**/*.test.*', '**/*.e2e.*', '**/*.stories.*'],
    },
  ],
  format: formatter({ lineNumbers: false }),
});
