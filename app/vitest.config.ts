import { defineConfig } from "vitest/config";

// Unit tests for pure app logic (lib/*). No DOM/Next runtime needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
