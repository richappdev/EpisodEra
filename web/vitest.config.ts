import {defineConfig} from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      all: true,
      exclude: [
        "src/App.tsx",
        "src/AppContext.tsx",
        "src/api/**",
        "src/auth/**",
        "src/firebase.ts",
        "src/main.tsx",
        "src/pages/AuthPage.tsx",
        "src/routes/**",
        "src/test/**",
        "src/vite-env.d.ts",
        "src/**/*.test.{ts,tsx}",
      ],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        branches: 70,
        functions: 60,
        lines: 75,
        statements: 75,
      },
    },
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
