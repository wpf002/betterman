/**
 * Repo-wide ESLint. Run from the root so plugin resolution is unambiguous
 * under pnpm's isolated node_modules.
 */
module.exports = {
  ...require('./packages/config/eslint/base.cjs'),
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.next/',
    '.turbo/',
    'coverage/',
    '**/*.cjs',
    'packages/db/src/generated/',
  ],
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      extends: ['next/core-web-vitals', 'prettier'],
      settings: { next: { rootDir: 'apps/web' } },
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: { node: true },
    },
  ],
};
