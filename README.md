# PDF Page Embedder

An Obsidian plugin for converting PDF page embeds into reusable WebP images while keeping a link to the original PDF page.

This is a personal development fork of [PDF Printer](https://github.com/cubexy/obsidian-pdf-printer). It retains PDF Printer's local PDF.js rendering foundation and adds a page-embed workflow for reusable slide and document images.

## Status

Initial development setup. The upstream PDF Printer behaviour is still present while the page-embed workflow below is implemented incrementally.

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

### Convert the page embed under the cursor

With the cursor anywhere inside:

```markdown
![[Lectures/Week 03.pdf#page=12]]
```

the page command will render or reuse only page 12. It will not require selecting the entire embed or opening a page-range prompt.

It will replace the original embed with a full, unambiguous path plus a page-specific source link below it:

```markdown
![[<output folder>/Lectures/Week 03/Week 03-012.webp]]
[[Lectures/Week 03.pdf#page=12|Week 03 — page 12]]
```

### Reusable, human-readable assets

- The image output folder remains configurable.
- Generated-image organization is configurable: use one shallow folder per PDF with either its filename or its flattened source path plus a stable short ID, or mirror the source PDF path with no generated ID. Identically named PDFs in different vault folders therefore cannot collide.
- Image names remain readable: `<PDF filename>-<three-digit page>.webp`.
- If the expected output image already exists, it is reused and no duplicate is rendered.
- A separate re-render command can explicitly replace an existing image when the source PDF changes.

PDF embeds use documented fragment parameters such as `#page=3&height=400`; the `|...` notation is not PDF width syntax. If a source embed includes a pipe value, the fork treats it as display text and will not silently turn a numeric value into a narrow image.

### Source-link placement

The link to the source PDF page will support `none`, `above`, and `below` placement. `below` is the intended default for the cursor page command.

### Keep the useful upstream workflows

- The existing selection-and-page-range commands remain available for occasional multi-page conversion.
- The native PDF-preview menu remains available.
- WebP quality, output-folder, image-embed formatting, and spacing settings remain configurable.

Vault-wide or whole-note conversion is deliberately not part of the first scope: this fork is designed around converting and reusing specific pages while studying.

## License and attribution

This project is derived from [PDF Printer](https://github.com/cubexy/obsidian-pdf-printer) by cubexy and remains licensed under the MIT License. The original copyright and license notice are preserved in [LICENSE](LICENSE).
