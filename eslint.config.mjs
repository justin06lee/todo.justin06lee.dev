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
  ]),
  {
    // Vendored chrome registry code (own-the-code installs). It lints clean
    // under the registry's own config; this repo's newer eslint-config-next
    // adds React-Compiler-powered rules that flag patterns the registry uses
    // deliberately (ref reads during render in the line-sync engine, draft
    // re-sync setState in effects). Scope those rules off for the vendored
    // paths only — local code keeps full strictness.
    files: ["components/chrome/**", "hooks/**"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
