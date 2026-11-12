// Lint rules from the Vistage Node/React standards: curly braces everywhere, no var, prefer const.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'client/dist/', 'client/node_modules/'] },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'scripts/**/*.js', '*.js', 'client/vite.config.js'],
    languageOptions: { globals: globals.node },
    rules: { curly: ['error', 'all'], 'no-var': 'error', 'prefer-const': 'error' },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } }, sourceType: 'module' },
    rules: {
      curly: ['error', 'all'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z]' }],
    },
  },
];
