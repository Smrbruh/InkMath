# Security

Security fixes target the latest published version. There is currently no maintenance commitment for older releases.

Do not attach secrets, private documents or exploit payloads to public issues. If GitHub offers **Report a vulnerability** in this repository's Security tab, use that private channel. Otherwise open an issue requesting a private reporting channel, without disclosing the vulnerability itself.

InkMath disables Node.js integration in the renderer, enables context isolation and Electron's renderer sandbox, blocks new windows and unexpected navigation, and invokes Tectonic with `--untrusted`. These are defensive measures, not a guarantee that arbitrary hostile TeX is safe. Use documents and dependencies you trust.

Compiler downloads are pinned and SHA-256 verified. Release executables are currently unsigned. A matching checksum confirms download integrity, not publisher identity.
