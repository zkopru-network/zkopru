module.exports = {
  globals: {
    artifacts: true,
    contract: true,
    it: true,
    before: true,
    beforeEach: true,
    assert: true
  },
  env: {
    mocha: true, // for test files
    "truffle/globals": true // same as "truffle/truffle": true
  },
  plugins: ["truffle"],
  rules: {
    "no-console": "off",
    "no-restricted-syntax": "off",
    "no-await-in-loop": "off",
    "no-loop-func": "off",
    "import/no-dynamic-require": "off",
    "global-require": "off",
    "import/no-extraneous-dependencies": ["error", { devDependencies: true }],
    "@typescript-eslint/camelcase": "warn",
    "@typescript-eslint/ban-ts-ignore": "warn",
    "import/no-unresolved": "warn",
    "import/export": "warn"
  }
};
