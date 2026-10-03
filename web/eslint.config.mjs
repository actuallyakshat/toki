import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // beUI sources are installed as-is and kept close to upstream.
    "src/components/motion/**",
    "src/components/charts/**",
    "src/lib/ease.ts",
    "src/lib/touch.ts",
    "src/lib/command-search.ts",
    "src/lib/presence-gate.tsx",
    "src/lib/hooks/use-dismiss.ts",
    "src/lib/hooks/use-hover-capable.ts",
    "src/lib/hooks/use-hover-gesture.ts",
    "src/lib/hooks/use-on-open.ts",
    "src/lib/hooks/use-row-cursor.ts",
    "src/lib/hooks/use-tap-gesture.ts",
    "src/lib/hooks/use-touch-capable.ts",
  ]),
]);

export default eslintConfig;
