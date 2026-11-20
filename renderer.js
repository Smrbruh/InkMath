import * as pdfjs from './node_modules/pdfjs-dist/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  './node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;
const api = window.inkmath,
  $ = (id) => document.getElementById(id);
let state,
  saveTimer,
  toastTimer,
  pdfDoc,
  pdfTask,
  page = 1,
  zoom = 1,
  renderTask,
  renderGeneration = 0,
  building = false,
  builtSignature = '',
  buildLog = '',
  filter = 'all',
  search = '';
const current = () => state.notes.find((n) => n.id === state.active);
const signature = () => JSON.stringify([state.active, current()?.source, current()?.settings]);
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 4000);
}
function sync() {
  const n = current();
  if (n) {
    if (n.source !== $('editor').value || n.title !== $('note-title').value) n.updated = Date.now();
    n.source = $('editor').value;
    n.title = $('note-title').value || 'Без названия';
  }
}
async function save() {
  clearTimeout(saveTimer);
  sync();
  try {
    await api['save-library'](state);
    $('save-status').textContent = 'Сохранено на компьютере';
  } catch (e) {
    $('save-status').textContent = 'Не удалось сохранить';
    toast(e.message);
  }
}
function scheduleSave() {
  sync();
  $('save-status').textContent = 'Сохранение…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 450);
  updateCounts();
  markStale();
}
function updateCounts() {
  const text = $('editor').value;
  $('word-count').textContent =
    text.trim().split(/\s+/).filter(Boolean).length.toLocaleString('ru') + ' слов';
  const before = text.slice(0, $('editor').selectionStart);
  $('cursor').textContent =
    `Строка ${before.split('\n').length} · Столбец ${before.length - before.lastIndexOf('\n')}`;
}
function markStale() {
  const fresh = signature() === builtSignature;
  $('export-pdf').disabled = !fresh || building;
  $('preview-state').textContent = pdfDoc ? (fresh ? 'ГОТОВО' : 'НУЖНА СБОРКА') : 'ПРЕДПРОСМОТР';
}
function library() {
  const nav = $('library');
  nav.replaceChildren();
  $('all-count').textContent = state.notes.length;
  let notes = state.notes.filter(
    (n) =>
      (filter !== 'favorites' || n.favorite) &&
      (!search || (n.title + ' ' + n.source).toLocaleLowerCase().includes(search)),
  );
  if (filter === 'recent') notes = [...notes].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  for (const n of notes) {
    const b = document.createElement('button');
    b.className = 'note-item' + (n.id === state.active ? ' active' : '');
    b.title = n.title;
    const icon = document.createElement('span');
    icon.className = 'notebook-icon';
    icon.dataset.icon = n.favorite ? 'star' : 'notebook';
    const title = document.createElement('span');
    title.textContent = n.title;
    b.append(icon, title);
    const select = async () => {
      if (building) {
        toast('Дождись сборки или отмени её.');
        return false;
      }
      await save();
      state.active = n.id;
      await selectNote();
      await save();
      return true;
    };
    b.onclick = select;
    b.oncontextmenu = async (e) => {
      e.preventDefault();
      if (state.active !== n.id && !(await select())) return;
      const menu = $('note-menu');
      menu.hidden = false;
      menu.style.left = Math.min(e.clientX, innerWidth - 200) + 'px';
      menu.style.top = Math.min(e.clientY, innerHeight - 120) + 'px';
      $('favorite-note').textContent = n.favorite ? 'Убрать из избранного' : 'В избранное';
    };
    nav.append(b);
  }
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.style.padding = '12px';
    empty.textContent = 'Здесь пока нет заметок';
    nav.append(empty);
  }
  window.dispatchEvent(new Event('library-change'));
}
async function selectNote() {
  const n = current();
  n.annotations ||= {};
  $('editor').value = n.source;
  $('note-title').value = n.title;
  for (const id of ['font', 'size', 'paper']) $(id).value = n.settings[id];
  document.querySelectorAll('[data-ink]').forEach((b) => {
    b.classList.toggle('selected', b.dataset.ink === n.settings.ink);
    b.setAttribute('aria-pressed', b.dataset.ink === n.settings.ink);
  });
  library();
  updateCounts();
  builtSignature = '';
  await clearPreview();
  markStale();
  $('log').hidden = true;
  window.dispatchEvent(new Event('note-change'));
}
async function clearPreview() {
  renderGeneration++;
  if (renderTask) {
    renderTask.cancel();
    await renderTask.promise.catch(() => {});
    renderTask = null;
  }
  if (pdfTask) {
    await pdfTask.destroy();
    pdfTask = null;
  }
  pdfDoc = null;
  $('paper-sheet').hidden = true;
  $('pdf-canvas').hidden = true;
  $('empty').hidden = false;
  $('page-total').textContent = '/ 0';
  $('page-number').value = 1;
  for (const id of ['prev-page', 'next-page', 'page-number']) $(id).disabled = true;
  $('pdf-info').textContent = 'Локальная компиляция';
}
async function loadPdf(base64) {
  await clearPreview();
  const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const byteLength = data.length;
  pdfTask = pdfjs.getDocument({ data, isEvalSupported: false });
  pdfDoc = await pdfTask.promise;
  page = 1;
  $('empty').hidden = true;
  $('pdf-canvas').hidden = false;
  $('page-total').textContent = '/ ' + pdfDoc.numPages;
  $('page-number').max = pdfDoc.numPages;
  $('page-number').disabled = false;
  $('pdf-info').textContent = `PDF · ${Math.round(byteLength / 1024)} КБ`;
  await renderPage();
}
async function renderPage() {
  if (!pdfDoc) return;
  const generation = ++renderGeneration;
  if (renderTask) {
    renderTask.cancel();
    await renderTask.promise.catch(() => {});
    renderTask = null;
  }
  const p = await pdfDoc.getPage(page);
  if (generation !== renderGeneration) return;
  const viewport = p.getViewport({ scale: 1 });
  const available = Math.min(850, Math.max(250, $('preview-scroll').clientWidth - 64));
  const scale = (available / viewport.width) * zoom;
  const dpr = window.devicePixelRatio || 1;
  const v = p.getViewport({ scale: scale * dpr });
  const canvas = $('pdf-canvas');
  canvas.width = Math.floor(v.width);
  canvas.height = Math.floor(v.height);
  canvas.style.width = Math.floor(v.width / dpr) + 'px';
  canvas.style.height = Math.floor(v.height / dpr) + 'px';
  $('paper-sheet').hidden = false;
  $('paper-sheet').style.width = canvas.style.width;
  $('paper-sheet').style.height = canvas.style.height;
  $('ink-layer').setAttribute('viewBox', `0 0 1000 ${(viewport.height / viewport.width) * 1000}`);
  const task = p.render({ canvasContext: canvas.getContext('2d'), viewport: v });
  renderTask = task;
  await task.promise.catch((e) => {
    if (e.name !== 'RenderingCancelledException') throw e;
  });
  if (generation !== renderGeneration) return;
  renderTask = null;
  $('page-number').value = page;
  $('prev-page').disabled = page === 1;
  $('next-page').disabled = page === pdfDoc.numPages;
  $('zoom-label').textContent = Math.round(zoom * 100) + '%';
  window.dispatchEvent(new Event('page-rendered'));
}
async function build() {
  if (building) {
    await api['cancel-compile']();
    return;
  }
  sync();
  await save();
  building = true;
  const stamp = signature();
  builtSignature = '';
  $('build').textContent = 'Отменить сборку';
  $('preview-state').textContent = 'СОБИРАЕТСЯ…';
  $('export-pdf').disabled = true;
  buildLog = '';
  $('log').textContent = 'Компиляция LaTeX. При первой сборке загружаются необходимые пакеты…';
  $('empty-build').disabled = true;
  try {
    const n = current();
    const result = await api.compile({ source: n.source, settings: n.settings });
    buildLog = result.log;
    $('log').textContent = buildLog;
    if (!result.ok) {
      $('log').hidden = false;
      toast('Сборка не завершена. Подробности в журнале.');
    } else {
      await loadPdf(result.pdf);
      builtSignature = stamp;
      toast('Конспект готов: ' + pdfDoc.numPages + ' стр.');
    }
  } catch (e) {
    $('log').textContent = e.message;
    $('log').hidden = false;
    toast('Не удалось собрать документ.');
  } finally {
    building = false;
    $('build').innerHTML =
      '<span data-icon="play"></span><span class="button-label">Собрать</span>';
    $('empty-build').disabled = false;
    markStale();
    window.dispatchEvent(new Event('library-change'));
    if (!$('log').hidden) {
      document.querySelector('.editor-pane').hidden = false;
      await renderPage();
    }
  }
}
async function guard(fn) {
  try {
    await fn();
  } catch (e) {
    toast(e.message || String(e));
  }
}
$('editor').addEventListener('input', scheduleSave);
$('editor').addEventListener('click', updateCounts);
$('editor').addEventListener('keyup', updateCounts);
$('note-title').addEventListener('input', () => {
  scheduleSave();
  library();
});
$('editor').addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    $('editor').setRangeText('  ', $('editor').selectionStart, $('editor').selectionEnd, 'end');
    scheduleSave();
  }
});
for (const id of ['font', 'size', 'paper'])
  $(id).onchange = () => {
    current().settings[id] = id === 'size' ? Number($(id).value) : $(id).value;
    scheduleSave();
  };
document.querySelectorAll('[data-ink]').forEach(
  (b) =>
    (b.onclick = () => {
      current().settings.ink = b.dataset.ink;
      document.querySelectorAll('[data-ink]').forEach((s) => {
        s.classList.toggle('selected', s === b);
        s.setAttribute('aria-pressed', s === b);
      });
      scheduleSave();
    }),
);
$('build').onclick = () => guard(build);
$('empty-build').onclick = () => guard(build);
$('toggle-log').onclick = () => ($('log').hidden = !$('log').hidden);
api.onProgress((text) => {
  buildLog = (buildLog + text).slice(-80000);
  $('log').textContent = buildLog;
  $('log').scrollTop = $('log').scrollHeight;
});
$('export-pdf').onclick = () =>
  guard(async () => {
    if (signature() !== builtSignature) return toast('Сначала собери обновлённый конспект.');
    if (
      await api['export-pdf']({ title: current().title, annotations: current().annotations || {} })
    )
      toast('PDF сохранён вместе с пометками.');
  });
$('export-tex').onclick = () =>
  guard(async () => {
    sync();
    if (await api['export-tex'](current())) toast('Исходник LaTeX сохранён.');
  });
$('new-note').onclick = () =>
  guard(async () => {
    if (building) return toast('Сначала закончи или отмени сборку.');
    if (state.notes.length >= 150) return toast('В библиотеке уже 150 тетрадей.');
    await save();
    const n = {
      id: crypto.randomUUID(),
      title: 'Новая тетрадь',
      source:
        '% Пиши здесь текст и формулы LaTeX.\n% Новый лист: \\newpage\\mbox{}\n\\thispagestyle{empty}\n\\mbox{}\n',
      settings: { font: 'segoe', size: 11, paper: 'plain', ink: 'blue' },
    };
    state.notes.push(n);
    state.active = n.id;
    await selectNote();
    await save();
    await build();
    $('note-title').focus();
    $('note-title').select();
  });
$('import').onclick = () =>
  guard(async () => {
    if (building) return toast('Сначала закончи или отмени сборку.');
    const result = await api['import-file']();
    if (!result) return;
    await save();
    if (result.type === 'library') {
      for (const n of result.data.notes) state.notes.push({ ...n, id: crypto.randomUUID() });
      if (state.notes.length > 150) {
        state.notes.splice(150);
        toast('Достигнут предел: 150 конспектов.');
      }
      state.active = state.notes.at(-1).id;
    } else {
      const n = {
        id: crypto.randomUUID(),
        title: result.title,
        source: result.source,
        settings: { font: 'segoe', size: 11, paper: 'plain', ink: 'blue' },
      };
      state.notes.push(n);
      state.active = n.id;
    }
    await selectNote();
    await save();
    toast('Файл открыт.');
  });
$('backup').onclick = () =>
  guard(async () => {
    await save();
    if (await api['backup-library'](state)) toast('Резервная копия сохранена.');
  });
$('guide').onclick = () => guard(() => api['open-guide']());
$('delete-note').onclick = () => {
  if (building) return toast('Сначала закончи или отмени сборку.');
  if (state.notes.length === 1) return toast('Оставь хотя бы один конспект.');
  $('delete-dialog').showModal();
};
$('delete-cancel').onclick = () => $('delete-dialog').close();
$('delete-confirm').onclick = () =>
  guard(async () => {
    state.notes = state.notes.filter((n) => n.id !== state.active);
    state.active = state.notes[0].id;
    $('delete-dialog').close();
    await selectNote();
    await save();
  });
$('prev-page').onclick = () =>
  guard(async () => {
    if (page > 1) {
      page--;
      await renderPage();
      $('preview-scroll').scrollTop = 0;
    }
  });
$('next-page').onclick = () =>
  guard(async () => {
    if (pdfDoc && page < pdfDoc.numPages) {
      page++;
      await renderPage();
      $('preview-scroll').scrollTop = 0;
    }
  });
$('page-number').onchange = () =>
  guard(async () => {
    if (pdfDoc) {
      page = Math.min(pdfDoc.numPages, Math.max(1, Number($('page-number').value) || 1));
      await renderPage();
      $('preview-scroll').scrollTop = 0;
    }
  });
$('zoom-in').onclick = () =>
  guard(async () => {
    zoom = Math.min(2, zoom + 0.1);
    await renderPage();
  });
$('zoom-out').onclick = () =>
  guard(async () => {
    zoom = Math.max(0.5, zoom - 0.1);
    await renderPage();
  });
let resizeTimer;
window.onresize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => guard(renderPage), 150);
};
const snippets = {
  section: '\n\\subsection{Новая идея}\n\n',
  equation: '\n\\[\n  E[X] = \\sum_x x p_X(x)\n\\]\n',
  align: '\n\\begin{align*}\n  a &= b + c \\\\\n    &= d.\n\\end{align*}\n',
  list: '\n\\begin{itemize}\n\\item Первый пункт.\n\\item Второй пункт.\n\\end{itemize}\n',
};
document.querySelectorAll('[data-snippet]').forEach(
  (b) =>
    (b.onclick = () => {
      const e = $('editor');
      e.setRangeText(snippets[b.dataset.snippet], e.selectionStart, e.selectionEnd, 'end');
      e.focus();
      scheduleSave();
    }),
);
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    guard(build);
  }
  if (e.ctrlKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    guard(save);
  }
});
api.onClose(() =>
  guard(async () => {
    sync();
    await api['close-app'](state);
  }),
);
const { initStudio } = await import('./studio.js');
initStudio({
  current,
  page: () => page,
  save: () => {
    current().updated = Date.now();
    return save();
  },
  toast,
  renderPage,
  hasPdf: () => !!pdfDoc,
  isBuilding: () => building,
  scheduleSave,
  library,
  setFilter: (value) => {
    filter = value;
    library();
  },
  setSearch: (value) => {
    search = value.toLocaleLowerCase();
    library();
  },
  changeZoom: async (delta) => {
    zoom = Math.min(2.5, Math.max(0.5, zoom + delta));
    await renderPage();
  },
});
await guard(async () => {
  state = await api['load-library']();
  if (!state.notes.length) throw new Error('Library is empty. Restore a backup.');
  await selectNote();
  await save();
  if (state.recovery) toast('Создана копия повреждённой библиотеки для восстановления.');
  const initial = await api['default-pdf'](current());
  if (initial) {
    await loadPdf(initial);
    builtSignature = signature();
    markStale();
  }
});
