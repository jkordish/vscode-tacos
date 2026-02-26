module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        module: {
          type: 'commonjs'
        },
        jsc: {
          target: 'es2022',
          parser: {
            syntax: 'typescript',
            decorators: false
          }
        }
      }
    ]
  }
};
