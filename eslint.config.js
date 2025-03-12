'use strict';

const { defineConfig } = require('eslint/config');
const pluginJs = require('@eslint/js');
const pluginSecurity = require('eslint-plugin-security');
const pluginJsDoc = require('eslint-plugin-jsdoc');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = defineConfig([
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
        sourceType: 'script',
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
