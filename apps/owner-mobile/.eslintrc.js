module.exports = {
  root: true,
  extends: ["expo", "prettier"],
  ignorePatterns: ["/dist/*", "/.expo/*"],
  rules: {
    "import/order": "off",
  },
};
