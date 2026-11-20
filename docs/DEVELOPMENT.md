# Development

## Prerequisites

- Windows x64, Node.js 24 or newer, npm and Git.
- Standard Windows fonts: Segoe Print, Segoe UI, Comic Sans MS and Georgia.
- Internet access for dependencies, the compiler and the initial TeX package cache.

```powershell
npm ci
npm run setup
npm start
```

The setup script uses the official Tectonic release pinned in `vendor/tectonic.lock.json`. Both ZIP and executable hashes are checked. The executable is intentionally excluded from Git. Electron's installation script is also run to ensure its runtime exists.

## Checks

| Command                | Purpose                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `npm run check`        | Parse JavaScript files with Node                                                   |
| `npm test`             | Template, settings, Unicode and annotation-export tests                            |
| `npm run test:compile` | Compile Cyrillic and the full example; check page counts and layout/glyph warnings |
| `npm run format:check` | Verify Prettier formatting                                                         |
| `npm run screenshots`  | Capture the actual app using an isolated temporary profile                         |
| `npm run package`      | Create the portable Windows x64 application                                        |

Compilation fixtures are written to `.cache/compile-tests`. Screenshots are written to `docs/media`. The screenshot harness does not open or alter your normal InkMath library.

## Packaging

Packaging uses Electron Packager, includes the verified Tectonic executable and excludes development files. ASAR is disabled so the compiler remains a real executable on disk. The result is `dist/InkMath-win32-x64`; distribute the entire folder in a ZIP, not just `InkMath.exe`.

The lockfile pins JavaScript dependency resolution. This makes setup repeatable, but binary outputs are not claimed to be bit-for-bit reproducible. Builds are currently unsigned.

## Release process

Update `package.json`, its lockfile and `CHANGELOG.md` together. Run all checks and inspect the application. Push a matching `vX.Y.Z` tag to trigger the release workflow. It compiles, tests and packages on Windows, then publishes the portable ZIP and its SHA-256 checksum through GitHub Releases.

Never commit `node_modules`, `dist`, user libraries or the downloaded compiler. To update Tectonic, verify its official release and update both hashes in the lock manifest before testing and packaging.
