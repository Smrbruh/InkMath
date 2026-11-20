import katex from './node_modules/katex/dist/katex.mjs';
const $ = (id) => document.getElementById(id),
  ns = 'http://www.w3.org/2000/svg';
const icons = {
  sidebar: 'M3 4h18v16H3z M9 4v16',
  search: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M15 15l6 6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  notes: 'M7 3h13v15H7z M4 6v15h13',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v6l4 2',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  notebook: 'M5 3h15v18H5z M8 3v18 M3 7h4 M3 12h4 M3 17h4',
  folder: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h9v3',
  archive: 'M3 4h18v4H3z M5 8v13h14V8 M9 12h6',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01',
  cursor: 'm5 3 13 10-6 1-3 6z',
  pen: 'm5 15 10-10 4 4L9 19l-5 1z M13 7l4 4 M15 5l2-2 4 4-2 2',
  highlighter: 'm7 14 8-11 6 4-8 11z M7 14l6 4-3 3H3z',
  eraser: 'm4 13 10-10 7 7-10 10H7z M9 8l7 7 M11 20h10',
  lasso: 'M20 10c0 5-7 8-12 6S1 10 4 6s12-5 15 0 1 9-3 13c-2 2-5 2-6 0s1-4 3-3',
  shape: 'M4 4h16v16H4z',
  text: 'M4 4h16 M12 4v16 M8 20h8',
  sliders: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  undo: 'M8 4 3 9l5 5 M3 9h11a7 7 0 0 1 0 14',
  redo: 'm16 4 5 5-5 5 M21 9H10a7 7 0 0 0 0 14',
  code: 'm8 5-6 7 6 7 M16 5l6 7-6 7 M14 3l-4 18',
  play: 'm7 4 13 8-13 8z',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  focus: 'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
  close: 'm6 6 12 12 M18 6 6 18',
  'chevron-left': 'm15 5-7 7 7 7',
  'chevron-right': 'm9 5 7 7-7 7',
  trash: 'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
};
function paintIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const path = icons[el.dataset.icon];
    if (path)
      el.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  });
}
function el(tag, attrs = {}) {
  const node = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}
const pathString = (points) =>
  points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ') +
  (points.length === 1 ? ' l .01 .01' : '');
function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length))
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function initStudio(ctx) {
  let tool = 'select',
    selection = new Set(),
    gesture = null,
    space = false,
    textPoint = [80, 100];
  const histories = new Map(),
    layer = $('ink-layer');
  const key = () => ctx.current().id + ':' + ctx.page();
  const items = () => {
    const n = ctx.current();
    n.annotations ||= {};
    return (n.annotations[ctx.page()] ||= []);
  };
  const history = () => {
    if (!histories.has(key())) histories.set(key(), { past: [], future: [] });
    return histories.get(key());
  };
  const remember = () => {
    const h = history();
    h.past.push(structuredClone(items()));
    if (h.past.length > 100) h.past.shift();
    h.future = [];
  };
  function buttons() {
    if (!ctx.current()) return;
    const h = history();
    $('undo').disabled = !h.past.length;
    $('redo').disabled = !h.future.length;
    $('selection-bar').hidden = !selection.size;
    $('selection-count').textContent = selection.size + ' выбрано';
  }
  function itemNode(item) {
    if (item.kind === 'text') {
      const t = el('text', {
        x: item.x,
        y: item.y,
        fill: item.color,
        'font-family': 'Segoe UI',
        'font-size': item.width || 18,
      });
      t.textContent = item.text;
      return t;
    }
    return el('path', {
      d: pathString(item.points),
      fill: 'none',
      stroke: item.color,
      'stroke-width': item.width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      opacity: item.kind === 'highlighter' ? 0.3 : 1,
    });
  }
  function redraw() {
    if (!ctx.current()) return;
    layer.replaceChildren();
    for (const item of items()) {
      layer.append(itemNode(item));
      if (selection.has(item.id)) {
        const pts =
          item.kind === 'text'
            ? [
                [item.x, item.y - 20],
                [item.x + Math.max(25, item.text.length * 10), item.y + 4],
              ]
            : item.points;
        const xs = pts.map((p) => p[0]),
          ys = pts.map((p) => p[1]);
        layer.append(
          el('rect', {
            x: Math.min(...xs) - 6,
            y: Math.min(...ys) - 6,
            width: Math.max(...xs) - Math.min(...xs) + 12,
            height: Math.max(...ys) - Math.min(...ys) + 12,
            fill: 'none',
            stroke: '#596C9E',
            'stroke-width': 1.5,
            'stroke-dasharray': '5 4',
            'pointer-events': 'none',
          }),
        );
      }
    }
    buttons();
  }
  const point = (e) => {
    const r = layer.getBoundingClientRect();
    return [((e.clientX - r.left) * 1000) / r.width, ((e.clientY - r.top) * 1000) / r.width];
  };
  function hit(p) {
    return [...items()]
      .reverse()
      .find((s) =>
        s.kind === 'text'
          ? p[0] >= s.x - 5 &&
            p[0] <= s.x + s.text.length * (s.width || 18) * 0.65 &&
            p[1] >= s.y - (s.width || 18) &&
            p[1] <= s.y + 5
          : s.points.some(
              (q, i) => distanceToSegment(p, q, s.points[i + 1] || q) < Math.max(8, s.width),
            ),
      );
  }
  function setTool(t) {
    tool = t;
    selection.clear();
    document.querySelectorAll('[data-tool]').forEach((b) => {
      b.classList.toggle('selected', b.dataset.tool === t);
      b.setAttribute('aria-pressed', b.dataset.tool === t);
    });
    layer.dataset.tool = t;
    redraw();
  }
  function closePopovers(except) {
    document.querySelectorAll('.popover').forEach((p) => {
      if (p.id !== except) p.hidden = true;
    });
  }
  function toggle(id) {
    const open = $(id).hidden;
    closePopovers(id);
    $(id).hidden = !open;
  }
  function toggleSource() {
    const pane = document.querySelector('.editor-pane');
    pane.hidden = !pane.hidden;
    $('source-toggle').classList.toggle('selected', !pane.hidden);
    ctx.renderPage();
  }
  function focus() {
    document.body.classList.toggle('focus-mode');
    $('exit-focus').hidden = !document.body.classList.contains('focus-mode');
    closePopovers();
    ctx.renderPage();
  }
  document
    .querySelectorAll('[data-tool]')
    .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
  $('source-toggle').onclick = toggleSource;
  $('focus-toggle').onclick = focus;
  $('exit-focus').onclick = focus;
  $('toggle-library').onclick = () => {
    document.body.classList.toggle('library-hidden');
    ctx.renderPage();
  };
  $('settings-toggle').onclick = () => toggle('appearance-popover');
  $('pen-settings').onclick = () => toggle('pen-popover');
  document
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => ($(b.dataset.close).hidden = true)));
  $('pen-width').oninput = () => ($('pen-width-value').value = $('pen-width').value);
  $('search-toggle').onclick = () => {
    document.body.classList.remove('library-hidden');
    $('search-wrap').hidden = !$('search-wrap').hidden;
    if (!$('search-wrap').hidden) $('note-search').focus();
    ctx.renderPage();
  };
  $('note-search').oninput = () => ctx.setSearch($('note-search').value);
  document.querySelectorAll('[data-filter]').forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll('[data-filter]')
          .forEach((x) => x.classList.toggle('active', x === b));
        ctx.setFilter(b.dataset.filter);
      }),
  );
  $('rename-note').onclick = () => {
    $('note-menu').hidden = true;
    $('note-title').focus();
    $('note-title').select();
  };
  $('favorite-note').onclick = () => {
    ctx.current().favorite = !ctx.current().favorite;
    $('note-menu').hidden = true;
    ctx.library();
    ctx.save();
  };
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#note-menu')) $('note-menu').hidden = true;
  });
  $('note-menu').addEventListener('click', () => ($('note-menu').hidden = true));
  const resizer = $('sidebar-resizer');
  let resizing = false;
  resizer.onpointerdown = (e) => {
    resizing = true;
    resizer.setPointerCapture(e.pointerId);
  };
  resizer.onpointermove = (e) => {
    if (resizing)
      document.documentElement.style.setProperty(
        '--sidebar-width',
        Math.max(190, Math.min(340, e.clientX)) + 'px',
      );
  };
  resizer.onpointerup = () => {
    resizing = false;
    ctx.renderPage();
  };
  resizer.onkeydown = (e) => {
    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const w = document.querySelector('.sidebar').getBoundingClientRect().width;
      document.documentElement.style.setProperty(
        '--sidebar-width',
        Math.max(190, Math.min(340, w + (e.key === 'ArrowRight' ? 10 : -10))) + 'px',
      );
      ctx.renderPage();
    }
  };
  function renderMath() {
    try {
      katex.render($('math-source').value, $('math-preview'), {
        throwOnError: true,
        displayMode: true,
        trust: false,
        strict: 'ignore',
      });
    } catch (e) {
      $('math-preview').textContent = e.message;
      $('math-preview').style.fontSize = '12px';
    }
  }
  $('math-toggle').onclick = () => {
    toggle('math-popover');
    renderMath();
  };
  $('math-source').oninput = renderMath;
  document.querySelectorAll('[data-symbol]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = $('math-source');
        t.setRangeText(b.dataset.symbol, t.selectionStart, t.selectionEnd, 'end');
        renderMath();
        t.focus();
      }),
  );
  $('math-copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText($('math-source').value);
      ctx.toast('LaTeX скопирован.');
    } catch {
      ctx.toast('Выдели формулу и нажми Ctrl+C.');
    }
  };
  $('math-insert').onclick = () => {
    try {
      katex.renderToString($('math-source').value, { throwOnError: true, trust: false });
    } catch {
      return ctx.toast('Исправь формулу перед вставкой.');
    }
    const editor = $('editor');
    const formula = '\n\\[\n' + $('math-source').value + '\n\\]\n';
    let at = editor.selectionStart;
    const end = editor.value.lastIndexOf('\\end{document}');
    if (end >= 0 && at > end) at = end;
    editor.setRangeText(formula, at, at, 'end');
    ctx.scheduleSave();
    $('math-popover').hidden = true;
    document.querySelector('.editor-pane').hidden = false;
    editor.focus();
    ctx.renderPage();
    ctx.toast('Формула вставлена. Собери PDF, чтобы увидеть её на странице.');
  };
  function commit() {
    redraw();
    ctx.save();
  }
  function removeSelection() {
    if (!selection.size) return;
    remember();
    ctx.current().annotations[ctx.page()] = items().filter((s) => !selection.has(s.id));
    selection.clear();
    commit();
  }
  $('remove-selection').onclick = removeSelection;
  $('undo').onclick = () => {
    const h = history();
    if (!h.past.length) return;
    h.future.push(structuredClone(items()));
    ctx.current().annotations[ctx.page()] = h.past.pop();
    selection.clear();
    commit();
  };
  $('redo').onclick = () => {
    const h = history();
    if (!h.future.length) return;
    h.past.push(structuredClone(items()));
    ctx.current().annotations[ctx.page()] = h.future.pop();
    selection.clear();
    commit();
  };
  $('add-text').onclick = () => {
    const text = $('annotation-text').value.trim();
    if (!text) return;
    remember();
    items().push({
      id: crypto.randomUUID(),
      kind: 'text',
      text,
      x: textPoint[0],
      y: textPoint[1],
      width: 22,
      color: $('pen-color').value,
    });
    $('text-popover').hidden = true;
    $('annotation-text').value = '';
    commit();
  };
  layer.onpointerdown = (e) => {
    if (!ctx.hasPdf() || ctx.isBuilding() || e.button === 2) return;
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    const p = point(e);
    if (space || e.button === 1) {
      gesture = {
        kind: 'pan',
        client: [e.clientX, e.clientY],
        scroll: [$('preview-scroll').scrollLeft, $('preview-scroll').scrollTop],
      };
      return;
    }
    if (tool === 'text') {
      textPoint = p;
      toggle('text-popover');
      $('annotation-text').focus();
      return;
    }
    if (tool === 'select') {
      const item = hit(p);
      if (!item) {
        selection.clear();
        redraw();
        return;
      }
      if (!selection.has(item.id)) {
        if (!e.shiftKey) selection.clear();
        selection.add(item.id);
      }
      remember();
      gesture = { kind: 'move', start: p, before: structuredClone(items()) };
      redraw();
      return;
    }
    if (tool === 'lasso') {
      selection.clear();
      const visual = el('path', {
        fill: '#596C9E0A',
        stroke: '#596C9E',
        'stroke-width': 1.5,
        'stroke-dasharray': '5 4',
      });
      layer.append(visual);
      gesture = { kind: 'lasso', points: [p], visual };
      return;
    }
    if (tool === 'eraser') {
      remember();
      gesture = { kind: 'eraser' };
      const item = hit(p);
      if (item) {
        ctx.current().annotations[ctx.page()] = items().filter((s) => s.id !== item.id);
        redraw();
      }
      return;
    }
    remember();
    selection.clear();
    const pressure = e.pointerType === 'pen' ? Math.max(0.35, e.pressure) * 1.5 : 1;
    const item = {
      id: crypto.randomUUID(),
      kind: tool,
      points: [p],
      width:
        tool === 'highlighter'
          ? Number($('pen-width').value) * 5
          : Number($('pen-width').value) * pressure,
      color: $('pen-color').value,
    };
    items().push(item);
    const visual = itemNode(item);
    layer.append(visual);
    gesture = { kind: tool, item, visual, start: p };
  };
  layer.onpointermove = (e) => {
    if (!gesture) return;
    const p = point(e),
      g = gesture;
    if (g.kind === 'pan') {
      $('preview-scroll').scrollLeft = g.scroll[0] - (e.clientX - g.client[0]);
      $('preview-scroll').scrollTop = g.scroll[1] - (e.clientY - g.client[1]);
      return;
    }
    if (g.kind === 'move') {
      const dx = p[0] - g.start[0],
        dy = p[1] - g.start[1];
      ctx.current().annotations[ctx.page()] = g.before.map((s) =>
        !selection.has(s.id)
          ? s
          : s.kind === 'text'
            ? { ...s, x: s.x + dx, y: s.y + dy }
            : { ...s, points: s.points.map((q) => [q[0] + dx, q[1] + dy]) },
      );
      redraw();
      return;
    }
    if (g.kind === 'eraser') {
      const item = hit(p);
      if (item) {
        ctx.current().annotations[ctx.page()] = items().filter((s) => s.id !== item.id);
        redraw();
      }
      return;
    }
    if (g.kind === 'lasso') {
      g.points.push(p);
      g.visual.setAttribute('d', pathString(g.points) + ' Z');
      return;
    }
    if (g.kind === 'shape') {
      const a = g.start;
      g.item.points = [a, [p[0], a[1]], p, [a[0], p[1]], a];
    } else {
      const events = e.getCoalescedEvents?.() || [e];
      for (const event of events.length ? events : [e]) g.item.points.push(point(event));
    }
    g.visual.setAttribute('d', pathString(g.item.points));
  };
  function finish() {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.kind === 'lasso') {
      for (const s of items()) {
        const pts = s.kind === 'text' ? [[s.x, s.y]] : s.points;
        if (pts.some((p) => inPolygon(p, g.points))) selection.add(s.id);
      }
      redraw();
    } else if (g.kind !== 'pan') commit();
  }
  layer.onpointerup = finish;
  layer.onpointercancel = finish;
  layer.onlostpointercapture = finish;
  $('preview-scroll').addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        ctx.changeZoom(e.deltaY < 0 ? 0.05 : -0.05);
      }
    },
    { passive: false },
  );
  document.addEventListener('keydown', (e) => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
    if (e.key === 'F11') {
      e.preventDefault();
      focus();
      return;
    }
    if (e.key === 'Escape') {
      closePopovers();
      $('note-menu').hidden = true;
      selection.clear();
      redraw();
      if (document.body.classList.contains('focus-mode')) focus();
      return;
    }
    if (e.ctrlKey && ['b', 'e', 'f', 'n'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      ({
        b: () => $('toggle-library').click(),
        e: toggleSource,
        f: () => {
          document.body.classList.remove('library-hidden');
          $('search-wrap').hidden = false;
          $('note-search').focus();
        },
        n: () => $('new-note').click(),
      })[e.key.toLowerCase()]();
      return;
    }
    if (editing) return;
    if (e.key === ' ') {
      e.preventDefault();
      space = true;
      layer.style.cursor = 'grab';
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      $('undo').click();
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      $('redo').click();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeSelection();
      return;
    }
    if (e.ctrlKey || e.altKey) return;
    const tools = {
      v: 'select',
      p: 'pen',
      h: 'highlighter',
      e: 'eraser',
      l: 'lasso',
      r: 'shape',
      t: 'text',
    };
    if (tools[e.key.toLowerCase()]) setTool(tools[e.key.toLowerCase()]);
    if (e.key.toLowerCase() === 'm') $('math-toggle').click();
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      space = false;
      layer.style.cursor = '';
    }
  });
  window.addEventListener('blur', () => {
    space = false;
    layer.style.cursor = '';
    finish();
  });
  window.addEventListener('page-rendered', () => {
    selection.clear();
    redraw();
  });
  window.addEventListener('note-change', () => {
    selection.clear();
    gesture = null;
    closePopovers();
    redraw();
  });
  window.addEventListener('library-change', paintIcons);
  paintIcons();
}
