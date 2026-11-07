import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/coverage/**"]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ["frontend/src/**/*.{js,ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "*.{js,mjs,cjs,ts}",
      "backend/**/*.{js,ts}",
      "scripts/**/*.{js,mjs}",
      "tests/**/*.{js,ts}",
      "frontend/*.config.{js,mjs,ts}",
    ],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
