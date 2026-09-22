import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    ".content-collections/**",
    "public/**",
    "evidence/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
