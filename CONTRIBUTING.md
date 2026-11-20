# Contributing to InkMath

Thanks for helping make mathematical notes easier to work with.

Before opening an issue, search existing issues and check the [current boundaries](README.md#current-boundaries). A useful bug report includes the Windows version, InkMath version, exact steps and a minimal LaTeX example. Remove personal information from screenshots, logs and notebooks.

## Development

Follow [Development](docs/DEVELOPMENT.md). Keep changes focused and explain the user-visible problem. For rendering or layout changes, include a real before/after screenshot. For compiler or export changes, provide a minimal input and inspect the resulting PDF.

Before submitting:

```powershell
npm run format
npm run check
npm test
npm run test:compile
```

Use the pull request template to describe the change and the checks you actually ran. Add a regression test when it protects meaningful behavior. Never commit personal notebooks, credentials, generated builds or downloaded compiler executables.

Be respectful, specific and constructive. Small, well-explained improvements are easier to review than unrelated changes bundled together.
