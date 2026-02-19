import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'style/semi': 'off',
    'style/brace-style': 'off',
    'style/arrow-parens': 'off',
    'antfu/if-newline': 'off',
    'no-use-before-define': 'off',
    'unused-imports/no-unused-vars': 'off',
    'eslint-comments/no-unlimited-disable': 'off',
  },
})
