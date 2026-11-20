// Capture the real renderer with an isolated, disposable profile.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'inkmath-capture-'));
app.setPath('userData', profile);
app.commandLine.appendSwitch('force-device-scale-factor', '1');
let completed = false;
const timeout = setTimeout(() => finish(new Error('Screenshot timed out.')), 60000);
function finish(error) {
  if (completed) return;
  completed = true;
  clearTimeout(timeout);
  if (error) console.error(error);
  app.isQuitting = true;
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  // Chromium can retain profile file handles until process exit.
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    console.warn('Temporary screenshot profile is still locked:', profile);
  }
  app.exit(error ? 1 : 0);
}
app.on('browser-window-created', (_, window) => {
  window.setContentSize(1440, 960);
  window.webContents.on('did-finish-load', async () => {
    try {
      await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (!document.getElementById('page-number').disabled) {
            clearInterval(timer); resolve();
          } else if (Date.now() - started > 30000) {
            clearInterval(timer); reject(new Error('PDF did not load'));
          }
        }, 100);
      })`);
      await window.webContents.executeJavaScript(`new Promise(resolve => {
        window.addEventListener('page-rendered', resolve, {once:true});
        const input = document.getElementById('page-number');
        input.value = 4; input.dispatchEvent(new Event('change'));
      })`);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const capture = await window.webContents.capturePage();
      const target = path.join(__dirname, '../docs/media/workspace.png');
      fs.writeFileSync(target, capture.toPNG());
      console.log('Saved real application screenshot:', target);
      await window.webContents.executeJavaScript(`new Promise(resolve => {
        window.addEventListener('page-rendered', resolve, {once:true});
        document.getElementById('source-toggle').click();
      })`);
      await new Promise((resolve) => setTimeout(resolve, 400));
      fs.writeFileSync(
        path.join(__dirname, '../docs/media/editor.png'),
        (await window.webContents.capturePage()).toPNG(),
      );
      finish();
    } catch (error) {
      finish(error);
    }
  });
});
require('../main.cjs');
