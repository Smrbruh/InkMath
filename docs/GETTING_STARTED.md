# Getting started

## Your first page

Open InkMath and select **Getting started**, or use the plus button in the library. Click **LaTeX** to show the source editor. A document body is enough:

```latex
\section{A small idea}
Вероятность события — число от нуля до единицы.
\[
  P(A\mid B)=\frac{P(A\cap B)}{P(B)}
\]
```

Press **Ctrl+Enter** to compile. The first build may take longer while Tectonic downloads packages. The log panel shows compilation errors. A full LaTeX document is also accepted; use a single file compatible with XeLaTeX.

## Paper and annotations

Open the page settings at the top right to choose a font, size, paper style and ink. Rebuild to apply changes. Select a drawing tool and mark the page. The eraser removes whole strokes; the lasso selects annotations for moving or deletion. Undo and redo apply to annotation actions.

The formula popover previews typed LaTeX with KaTeX and can insert it into the source. It does not recognise handwritten mathematics.

## Save, export and restore

- Notes autosave locally. The status at the top confirms successful saving.
- **PDF** exports the latest built document with its vector annotations.
- **Сохранить .tex** exports the document source without drawing annotations.
- **Резервная копия** saves the whole library, including annotations, as `.inkmath`.
- **Открыть файл** imports `.tex` or merges notebooks from a library backup.

Rebuild after editing the source before exporting PDF. If page layout changes, check your annotations: their positions stay fixed on each page.

## Keyboard shortcuts

| Shortcut        | Action                              |
| --------------- | ----------------------------------- |
| Ctrl+Enter      | Compile                             |
| Ctrl+N          | New notebook                        |
| Ctrl+B          | Show/hide library                   |
| Ctrl+E          | Show/hide LaTeX source              |
| Ctrl+F          | Search notebooks                    |
| Ctrl+Z / Ctrl+Y | Undo / redo annotation              |
| F11             | Focus mode                          |
| V / P / H / E   | Select / pen / highlighter / eraser |
| L / R / T / M   | Lasso / rectangle / text / formula  |
| Delete          | Delete selected annotations         |

Single-letter tool shortcuts are inactive while typing in an input. Some shortcuts can be intercepted by your operating system or keyboard software.

## Troubleshooting

Keep the extracted application folder intact. If compilation fails, check the log, internet connection and minimal LaTeX input. Fonts come from Windows; a modified installation without the expected fonts may need those fonts restored. Back up the library before reinstalling or upgrading. See [Privacy](PRIVACY.md) for data locations.
