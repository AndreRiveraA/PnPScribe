import { defineConfig, globalIgnores } from "eslint/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{
		languageOptions: {
			parserOptions: {
				project: ["./tsconfig.json"],
				tsconfigRootDir: appDir,
			},
		},
		rules: {
			// Striktere TypeScript-Regeln (optional)
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/strict-boolean-expressions": "warn",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"no-debugger": "error",
		},
	},
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		".next/**",
		"out/**",
		"build/**",
		"next-env.d.ts",
		"node_modules/**",
		"eslint.config.mjs",
		"postcss.config.mjs",
		"scripts/**/*.mjs",
	]),
]);

export default eslintConfig;
