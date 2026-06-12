import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Align ESLint with TS compiler unused checks and allow underscore-prefixed ignores
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  // Enforce frontend import policies within app/test code only. Tooling files
  // (e.g. Vite config) do not share the same alias assumptions.
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'date-fns',
              message: 'Use @/utils/datetime instead of date-fns.',
            },
            {
              name: 'moment',
              message: 'Moment is not allowed. Use Luxon via @/utils/datetime.',
            },
            {
              name: 'moment-timezone',
              message:
                'Moment Timezone is not allowed. Use Luxon via @/utils/datetime.',
            },
            {
              name: '@fullcalendar/moment',
              message:
                'Use @fullcalendar/luxon3 for named time zones and formatting.',
            },
            {
              name: '@fullcalendar/moment-timezone',
              message: 'Use @fullcalendar/luxon3 for named time zones.',
            },
            {
              name: 'luxon',
              message:
                'Import Luxon utilities from @/utils/datetime to keep policy centralized.',
            },
            {
              name: '@/utils',
              message:
                'Import from @/utils/<domain> (e.g. @/utils/datetime) instead of the root utils barrel.',
            },
          ],
          patterns: [
            {
              group: ['date-fns/*'],
              message: 'Use @/utils/datetime instead of date-fns.',
            },
            {
              group: ['../*', '../**'],
              message: 'Use @/… alias imports instead of parent relative imports.',
            },
            {
              group: ['@/utils/*/*'],
              message:
                'Import from @/utils/<domain> to keep utils exports stable (avoid deep imports).',
            },
          ],
        },
      ],
    },
  },
  // Allow the centralized datetime utility module to depend on Luxon directly.
  {
    files: ['src/utils/datetime/datetime.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'date-fns',
              message: 'Use @/utils/datetime instead of date-fns.',
            },
            {
              name: 'moment',
              message:
                'Moment is not allowed. Use Luxon via @/utils/datetime.',
            },
            {
              name: 'moment-timezone',
              message:
                'Moment Timezone is not allowed. Use Luxon via @/utils/datetime.',
            },
            {
              name: '@fullcalendar/moment',
              message:
                'Use @fullcalendar/luxon3 for named time zones and formatting.',
            },
            {
              name: '@fullcalendar/moment-timezone',
              message: 'Use @fullcalendar/luxon3 for named time zones.',
            },
          ],
          patterns: [
            {
              group: ['date-fns/*'],
              message: 'Use @/utils/datetime instead of date-fns.',
            },
            {
              group: ['../*', '../**'],
              message: 'Use @/… alias imports instead of parent relative imports.',
            },
            {
              group: ['@/utils/*/*'],
              message:
                'Import from @/utils/<domain> to keep utils exports stable (avoid deep imports).',
            },
          ],
        },
      ],
    },
  },
])
