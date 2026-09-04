module.exports = {
  root: true,
  extends: ["expo", "prettier"],
  ignorePatterns: ["/dist/*", "/.expo/*"],
  rules: {
    "import/order": "off", // handled by prettier/formatting, not worth fighting the ordering rule here
  },
};
