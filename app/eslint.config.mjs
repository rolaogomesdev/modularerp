import { defineConfig, globalIgnores } from "eslint/config";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

export default defineConfig([
  coreWebVitals,
  typescript,
  {
    // No hard-coded user-facing strings — everything through @repo/i18n
    // catalogs (golden rule 5). Props (className, ids, hrefs) are exempt.
    files: ["**/*.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: true, ignoreProps: true, noAttributeStrings: false },
      ],
    },
  },
  {
    // The /design gallery is a developer-only component showcase — its
    // specimen strings are not product copy (documented exception).
    files: ["app/design/**/*.tsx"],
    rules: {
      "react/jsx-no-literals": "off",
    },
  },
  globalIgnores([".next/**"]),
]);
