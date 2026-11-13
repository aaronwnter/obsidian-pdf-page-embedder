# PDF Page Embedder

An Obsidian plugin for converting PDF page embeds into reusable WebP images while keeping a link to the original PDF page.

This is a personal development fork of [PDF Printer](https://github.com/cubexy/obsidian-pdf-printer). It retains PDF Printer's local PDF.js rendering foundation and is intended to add a faster cursor-based workflow for embeds such as `![[Slides.pdf#page=12]]`.

## Status

Initial development setup. The upstream PDF Printer behaviour is still present while the page-embed workflow is designed and implemented.

## Development

Requirements: Node.js, npm, Obsidian, and Neovim or another editor.

```bash
npm ci
npm run dev
```

`npm run dev` watches the source and writes `main.js` in this directory. The isolated test vault should link its plugin directory to this repository:

```text
<test-vault>/.obsidian/plugins/pdf-page-embedder -> <this repository>
```

Open the test vault in Obsidian, enable **PDF Page Embedder** under Community plugins, and reload the plugin after a build if Obsidian does not do so automatically.

Run the build and unit tests before committing:

```bash
npm run build
npm test
```

## Planned workflow

With the cursor inside:

```markdown
![[Lectures/Week 03.pdf#page=12]]
```

the page command will render or reuse a deterministic WebP asset, replace the embed, and place a page-specific source link below it. The existing selection-and-range workflow remains available.

## License and attribution

This project is derived from [PDF Printer](https://github.com/cubexy/obsidian-pdf-printer) by cubexy and remains licensed under the MIT License. The original copyright and license notice are preserved in [LICENSE](LICENSE).
