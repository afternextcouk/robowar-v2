/**
 * ROBOWAR V2 — Jest Configuration for Tests
 * Author: İREM (QA & Simulation Specialist)
 */

import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/unit/**/*.test.ts"],
  moduleNameMapper: {
    // Map engine imports to the actual engine source
    "^../../engine/src/(.*)$": "<rootDir>/../engine/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2020",
          module: "CommonJS",
          moduleResolution: "node",
          esModuleInterop: true,
          strict: false,
        },
      },
    ],
  },
  collectCoverageFrom: [
    "../engine/src/**/*.ts",
    "!../engine/src/**/*.d.ts",
  ],
  coverageDirectory: "../test-results/coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  testTimeout: 30000,
};

export default config;
