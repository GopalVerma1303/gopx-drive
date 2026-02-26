/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/lib"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  transform: { "^.+\\.tsx?$": ["ts-jest", { useESM: false }] },
};
