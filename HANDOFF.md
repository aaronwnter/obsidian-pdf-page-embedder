# Session handoff

## Project locations

- Repository: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder`
- Isolated test vault: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder-test-vault`
- The test vault plugin path is a symlink to this repository:
  `.obsidian/plugins/pdf-page-embedder`.

Use only the isolated test vault for development and manual tests. Do not inspect or modify the personal vault unless the user explicitly authorizes it.

## Working agreement

1. Make one focused change.
2. Build and run `npm test`.
3. The user manually tests the change in the test vault.
4. Fix any issues, then commit only after the user accepts the result.
5. Do not push unless the user explicitly asks. The user currently asked to hold pushes.

Start the development watcher with:

```bash
npm run dev
```

After a build, reload or disable/enable **PDF Page Embedder** in the test vault.

## Current implementation

- Cursor-only detection, rendering, deterministic WebP output, reuse, and replacement of `![[PDF.pdf#page=N]]` embeds.
- Three image-organization choices: shallow filename plus ID, detailed shallow source path plus ID, and mirrored source folders.
- Source-link placement: none, above, or below.
- A local provenance index in ignored `data.json`, mapping cursor-generated WebPs to source PDF path, page number, and optional label.
- The old `preservePdfLink` setting is migrated away automatically on plugin load.

Useful commands in the test vault:

- `Inspect PDF page embed at cursor (development)`
- `Render PDF page embed at cursor (development)`
- `Convert PDF page embed at cursor`

## Test fixtures

The test vault contains `Example PDF.pdf`, `Landscape.pdf`, `Portrait.pdf`, and `Nested/Portrait.pdf`. The duplicate `Portrait.pdf` names are intentional.

## Next task

Implement **Add source link for generated image at cursor**. It should:

- Find a generated WebP embed under the cursor.
- Look up its provenance in `generatedPages`.
- Add the source PDF page link using the configured placement.
- Avoid adding a duplicate adjacent source link when run again.

Do not add an image-insertion command: standard Obsidian embedding already covers that use case. Current-note and vault-wide scopes are intentionally deferred; see [ROADMAP.md](ROADMAP.md).
