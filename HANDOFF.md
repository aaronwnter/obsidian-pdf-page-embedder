# Session handoff

## Project locations

- Repository: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder`
- Isolated test vault: `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder-test-vault`
- The test vault plugin path is a symlink to this repository:
  `.obsidian/plugins/pdf-page-embedder`.

Use only the isolated test vault for development and manual tests. NEVER inspect or modify the PersonalVault or ObsidianVault.

## Working agreement

1. Keep `main` usable for personal use. Start development from `main` on `feature/<topic>` or `dev/<topic>`, never directly on `main`.
2. Make one focused change, then run `npm run lint`, `npm run build`, and `npm test`.
3. The user manually tests the change in the isolated test vault.
4. Commit an accepted change on its development branch. Merge it into `main` only when the user asks to promote it.
5. Update `manifest.json` and `versions.json` only for an intentional release. Feature commits and branch merges do not bump the plugin version.
6. Do not push unless the user explicitly asks.

For the next feature, create a branch such as `feature/remove-uuid-pipeline` from the current `main` tip before editing files.

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
- Plain PDF embeds can render or insert a selected range or full document at the cursor. Every generated page has deterministic output and provenance.
- Settings can migrate existing generated images to the selected layout after a preview and explicit confirmation.

Useful commands in the test vault:

- `Convert PDF page embed at cursor`
- `Convert PDF pages`
- `Convert and insert PDF pages`
- `Refresh generated PDF image(s)`, from a generated WebP under the cursor or an active PDF
- `Add source link for generated image at cursor`
- `Repair generated-image index`

Use **Remove empty folders** under the Generated-image folder maintenance setting for cleanup. Use **Migrate generated images to current layout** in Settings when an explicit layout change is wanted. The next cleanup task removes the retired selection, preview, UUID, and development-only paths.

## Test fixtures

The test vault contains `PDFs/Landscape.pdf`, `PDFs/Portrait.pdf`, `PDFs/Nested/Example PDF.pdf`, and `Test/Portrait Test.pdf`.

## Next task

Remove superseded commands and the UUID pipeline. Remove the development-only render and inspect commands, deprecated selection commands, preview-menu conversion, UUID output folders, the `uuid` dependency, and formatting code used only by that pipeline. Confirm that no remaining command can create unindexed, non-deterministic generated images.

Do not add an image-insertion command: standard Obsidian embedding already covers that use case. Current-note and vault-wide scopes remain deferred; see [[ROADMAP.md]].

