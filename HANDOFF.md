# Session handoff

## Project locations

- Repository: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder`
- Isolated test vault: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder-test-vault`
- The test vault plugin path is a symlink to this repository:
  `.obsidian/plugins/pdf-page-embedder`.

Use only the isolated test vault for development and manual tests. NEVER inspect or modify the PersonalVault or ObsidianVault.

## Working agreement

1. Make one focused change.
2. Build and run `npm test`.
3. The user manually tests the change in the test vault.
4. Fix any issues, then commit only after the user accepts the result.
5. Do not push unless the user explicitly asks.

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
- Recursive source-index rebuild for generated WebPs in every supported output layout.
- Source lifecycle handling: link-aware image moves on PDF rename, modification-time stale detection, explicit refresh, and configured-root empty-folder cleanup.
- The provenance index retains records for missing WebPs while their source PDF exists. Rebuild reports them, and refresh recreates them at their recorded paths.
- Existing source folders retain their output layout. The longer source ID applies to new layouts only. A later Settings migration will consolidate folders on explicit confirmation.
- PDF renames are tracked while the plugin is enabled. A rename made while it is disabled cannot be safely matched from the stored paths alone.
- The old `preservePdfLink` setting is migrated away automatically on plugin load.

Useful commands in the test vault:

- `Convert PDF page embed at cursor`
- `Refresh generated PDF image(s)`, from a generated WebP under the cursor or an active PDF
- `Add source link for generated image at cursor`
- `Repair generated-image index`

Use **Remove empty folders** under the Generated-image folder maintenance setting for cleanup. The legacy selection and PDF-preview conversion code is not registered and must not be manually tested.

## Test fixtures

The test vault contains `PDFs/Landscape.pdf`, `PDFs/Portrait.pdf`, `PDFs/Nested/Example PDF.pdf`, and `Test/Portrait Test.pdf`.

## Next task

Remove superseded commands and the UUID pipeline. Remove the development-only render and inspect commands, deprecated selection commands, preview-menu conversion, UUID output folders, the `uuid` dependency, and formatting code used only by that pipeline. Confirm that no remaining command can create unindexed, non-deterministic generated images.

Do not add an image-insertion command: standard Obsidian embedding already covers that use case. Current-note and vault-wide scopes remain deferred; see [[ROADMAP.md]].

