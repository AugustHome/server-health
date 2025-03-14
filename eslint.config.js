import { defineConfig } from 'eslint/config';
import pluginJs from '@eslint/js';
import pluginSecurity from 'eslint-plugin-security';
import pluginJsDoc from 'eslint-plugin-jsdoc';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig([
  {
    ignores: ['node_modules/*', '.nyc_output/**', 'coverage/**'],
  },

  pluginJs.configs.recommended,
  pluginSecurity.configs.recommended,
  prettierConfig,

  {
    plugins: {
      security: pluginSecurity,
      jsdoc: pluginJsDoc,
    },
  },

  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
  },

  {
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
          },
        },
      ],
      'jsdoc/require-returns': ['error'],
      'jsdoc/require-returns-type': ['error'],
      yoda: ['warn', 'never'],
      'no-else-return': 'error',
      curly: 'error',
      'padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
    },
  },
]);
