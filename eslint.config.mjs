import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["main.js", "node_modules/**"],
	},
	js.configs.recommended,
	tseslint.configs.recommended,
	{
		files: ["**/*.{ts,mjs}"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				createEl: "readonly",
			},
		},
		rules: {
			"no-prototype-builtins": "off",
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
		},
	},
);
