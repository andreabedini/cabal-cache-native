import eslintPluginN from "eslint-plugin-n";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  eslintPluginN.configs["flat/recommended"],
  ...tseslint.configs.recommended,
);
