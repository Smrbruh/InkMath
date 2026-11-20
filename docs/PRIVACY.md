# Privacy and local storage

InkMath does not require an account and does not contain an analytics, advertising, cloud sync or crash-upload service.

## Storage

- Notebooks and annotations: `%APPDATA%\InkMath\library.json`.
- UI preferences and Chromium runtime data: the same application profile directory.
- Damaged library recovery copies: beside the library, with a `.recovery-` timestamp suffix.
- TeX package cache: Tectonic's Windows user cache, normally under `%LOCALAPPDATA%\TectonicProject\Tectonic`.
- Compilation files: a temporary `inkmath-` directory, cleaned up after compilation. An interrupted process can leave temporary files behind.
- Exports and backups: the paths you choose in the save dialog.

Deleting the portable application folder does not delete your notebook library. Back up your work before manually removing profile data. Exported PDFs can include document metadata and all annotations you chose to retain.

## Network

Tectonic downloads TeX resources when they are not cached. Dependency installation and setup contact npm, Electron's distribution service and GitHub. The app does not upload your source documents to an InkMath server; compilation runs on your computer. Network services receive ordinary connection metadata when contacted.

There is currently no automatic application updater. Download new versions from this repository's releases.
