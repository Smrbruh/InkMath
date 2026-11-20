const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { spawn } = require('node:child_process');
const { buildTex, normalizeSettings } = require('./latex.cjs');
let win,
  child,
  activeCompile = null,
  latest = null,
  statePath,
  saveQueue = Promise.resolve();
const root = __dirname;
app.setName('InkMath');
function validState(s) {
  if (!s || !Array.isArray(s.notes) || s.notes.length > 150)
    throw new Error('Invalid notebook library.');
  const notes = s.notes.map((n) => {
    if (!n || typeof n.id !== 'string' || typeof n.source !== 'string' || n.source.length > 2000000)
      throw new Error('Invalid notebook.');
    return {
      id: n.id.slice(0, 100),
      title: String(n.title || 'Untitled').slice(0, 150),
      source: n.source,
      settings: normalizeSettings(n.settings),
      favorite: !!n.favorite,
      updated: Number(n.updated) || Date.now(),
      annotations: n.annotations && typeof n.annotations === 'object' ? n.annotations : {},
    };
  });
  return {
    version: 1,
    active: notes.some((n) => n.id === s.active) ? s.active : notes[0]?.id,
    notes,
  };
}
async function saveState(s) {
  const clean = validState(s);
  const write = async () => {
    const temp = statePath + '.tmp';
    await fs.writeFile(temp, JSON.stringify(clean), 'utf8');
    await fs.rename(temp, statePath);
  };
  saveQueue = saveQueue.catch(() => {}).then(write);
  await saveQueue;
  return true;
}
function executeCompiler(file, dir) {
  return new Promise((resolve, reject) => {
    const exe = path.join(root, 'vendor', 'tectonic.exe');
    let output = '',
      settled = false,
      timer;
    child = spawn(exe, ['--untrusted', '--keep-logs', '--outdir', dir, file], {
      cwd: dir,
      windowsHide: true,
      env: { ...process.env },
    });
    const append = (data) => {
      output = (output + data.toString()).slice(-80000);
      win?.webContents.send('compile-progress', data.toString().slice(-4000));
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (e) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        child = null;
        reject(e);
      }
    });
    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        child = null;
        resolve({ code, output });
      }
    });
    timer = setTimeout(() => {
      child?.kill();
    }, 300000);
  });
}
app.whenReady().then(async () => {
  statePath = path.join(app.getPath('userData'), 'library.json');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  win = new BrowserWindow({
    width: 1500,
    height: 980,
    minWidth: 850,
    minHeight: 620,
    backgroundColor: '#FAFAF8',
    title: 'InkMath — Paper Studio',
    icon: path.join(root, 'assets', 'app.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(root, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  await win.loadFile(path.join(root, 'index.html'));
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.webContents.send('before-close');
    }
  });
});
ipcMain.handle('load-library', async () => {
  try {
    return { ...validState(JSON.parse(await fs.readFile(statePath, 'utf8'))), recovery: false };
  } catch (e) {
    let recovery = e.code !== 'ENOENT';
    if (recovery)
      await fs.copyFile(statePath, statePath + '.recovery-' + Date.now()).catch(() => {});
    return {
      version: 1,
      active: 'course',
      recovery,
      notes: [
        {
          id: 'course',
          title: 'Probability & Statistics',
          source: await fs.readFile(path.join(root, 'assets', 'course-body.tex'), 'utf8'),
          settings: normalizeSettings(),
        },
        {
          id: 'quickstart',
          title: 'Getting started',
          source: await fs.readFile(path.join(root, 'assets', 'quickstart.tex'), 'utf8'),
          settings: normalizeSettings({ paper: 'ruled' }),
        },
      ],
    };
  }
});
ipcMain.handle('save-library', (_, s) => saveState(s));
ipcMain.handle('close-app', async (_, s) => {
  await saveState(s);
  child?.kill();
  app.isQuitting = true;
  app.quit();
});
ipcMain.handle('compile', async (_, data) => {
  if (activeCompile) throw new Error('A build is already running.');
  const token = {};
  activeCompile = token;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'inkmath-'));
  try {
    const tex = buildTex(data.source, data.settings),
      file = path.join(dir, 'notebook.tex');
    await fs.writeFile(file, tex, 'utf8');
    const result = await executeCompiler(file, dir);
    if (result.code !== 0)
      return {
        ok: false,
        log: result.output || 'Build cancelled or timed out. Check your document and try again.',
      };
    const pdf = await fs.readFile(path.join(dir, 'notebook.pdf'));
    latest = { pdf, tex };
    return { ok: true, pdf: pdf.toString('base64'), log: result.output, bytes: pdf.length };
  } finally {
    activeCompile = null;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});
ipcMain.handle('cancel-compile', () => {
  child?.kill();
  return true;
});
ipcMain.handle('export-pdf', async (_, data) => {
  if (!latest) throw new Error('Build a preview first.');
  const title = typeof data === 'string' ? data : data.title;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export PDF',
    defaultPath: String(title || 'Notebook').replace(/[<>:"/\\|?*]/g, '_') + '.pdf',
    filters: [{ name: 'PDF document', extensions: ['pdf'] }],
  });
  if (canceled) return false;
  const { annotatePdf } = require('./annotations.cjs');
  const pdf = await annotatePdf(latest.pdf, data.annotations || {});
  await fs.writeFile(filePath, pdf);
  return true;
});
ipcMain.handle('export-tex', async (_, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save LaTeX source',
    defaultPath: 'notebook.tex',
    filters: [{ name: 'LaTeX document', extensions: ['tex'] }],
  });
  if (canceled) return false;
  await fs.writeFile(filePath, buildTex(data.source, data.settings), 'utf8');
  return true;
});
ipcMain.handle('import-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open LaTeX or InkMath backup',
    properties: ['openFile'],
    filters: [{ name: 'LaTeX / InkMath', extensions: ['tex', 'inkmath'] }],
  });
  if (canceled) return null;
  const file = filePaths[0];
  const stat = await fs.stat(file);
  if (stat.size > 12000000) throw new Error('File is too large (maximum 12 MB).');
  const text = await fs.readFile(file, 'utf8');
  if (path.extname(file) === '.inkmath')
    return { type: 'library', data: validState(JSON.parse(text)) };
  if (text.length > 2000000) throw new Error('LaTeX document exceeds 2 MB.');
  return { type: 'tex', title: path.basename(file, '.tex'), source: text };
});
ipcMain.handle('backup-library', async (_, s) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Back up notebooks',
    defaultPath: 'InkMath-library.inkmath',
    filters: [{ name: 'InkMath library', extensions: ['inkmath'] }],
  });
  if (canceled) return false;
  await fs.writeFile(filePath, JSON.stringify(validState(s), null, 2));
  return true;
});
ipcMain.handle('open-guide', () => shell.openPath(path.join(root, 'assets', 'Guide.txt')));
ipcMain.handle('default-pdf', async (_, note) => {
  try {
    const source = await fs.readFile(path.join(root, 'assets', 'course-body.tex'), 'utf8');
    if (
      note.source !== source ||
      JSON.stringify(normalizeSettings(note.settings)) !== JSON.stringify(normalizeSettings())
    )
      return null;
    const pdf = await fs.readFile(path.join(root, 'assets', 'course.pdf'));
    latest = { pdf, tex: buildTex(source, note.settings) };
    return pdf.toString('base64');
  } catch {
    return null;
  }
});
app.on('window-all-closed', () => {
  child?.kill();
  app.quit();
});
