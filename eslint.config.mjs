import nextVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  ...nextVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default config;
