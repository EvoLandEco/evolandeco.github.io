import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".cache/**",
    "atlas-worker/.wrangler/**",
    "atlas-worker/worker-configuration.d.ts",
    "out/**",
    ".content-collections/**",
    "public/**",
    "evidence/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
