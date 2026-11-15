# Roadmap

This project is a personal, cursor-first fork of PDF Printer. The goal is to turn a PDF page embed into a reusable WebP image while retaining a reliable route back to the original PDF page.

## Implemented

- Parse a `![[PDF.pdf#page=N]]` embed under the cursor without selecting it.
- Resolve relative PDF paths and page numbers, including PDF viewer parameters such as `#page=3&height=400`.
- Render only the requested PDF page as WebP.
- Reuse an already-rendered page instead of creating a duplicate.
- Save generated images with one of three configurable organization strategies:
  - Shallow: PDF filename plus stable source ID.
  - Detailed shallow: flattened source path plus stable source ID.
  - Mirrored: source PDF folders mirrored below the output folder.
- Replace the PDF embed under the cursor with the generated WebP embed.
- Add a page-specific source PDF link above, below, or not at all, according to settings.
- Preserve a pipe display value as the generated source-link label.
- Persist generated-image provenance: WebP path to source PDF path, page number, and label.
- Add a missing source PDF page link for a generated WebP embed under the cursor.
- Avoid duplicating an equivalent source link already adjacent to that image.
- Rebuild missing provenance records for generated WebPs in nested vault folders.
- Track source modification times, prevent stale-image reuse, and refresh one page or every generated page for a source PDF only on explicit command.
- Move recognized generated images to their new deterministic paths when a source PDF moves or is renamed, updating Obsidian links in the process.
- Remove empty folders only inside the configured generated-image root.

An **Insert generated PDF page image** command is intentionally out of scope. Obsidian already makes it easy to embed an image directly, so this would add no meaningful UI benefit.

## Next: ordered work

1. Replace the selection-based conversion pipeline with one provenance-aware service that resolves the PDF embed under the cursor.
   - Accept only plain PDF embeds such as `![[Lectures/Week 03.pdf]]` for range and full-document conversion.
   - Treat `![[Lectures/Week 03.pdf#page=12]]` as a single-page conversion. Do not offer range or full-document conversion for it.
   - Use deterministic output paths, reuse existing images, and record provenance for every generated page.
2. Add two cursor commands for a plain PDF embed: `Convert PDF pages` and `Convert and insert PDF pages`.
   - Both commands open the same input prompt.
   - Empty or whitespace-only input converts the full document.
   - `full`, in any letter case, converts the full document.
   - Page expressions such as `2-5` and `2, 5, 7-9` convert the inclusive selected pages.
   - Convert only creates or reuses generated files and records provenance without editing the note.
   - Convert and insert replaces the plain PDF embed with generated image embeds and follows the configured image spacing.
   - A full-document insert always adds one link to the source PDF above the generated image group, ignoring `sourceLinkPlacement`.
   - A range insert adds a page-specific source link for every generated image according to `sourceLinkPlacement`.
3. Remove the development-only commands once the user-facing commands replace their useful behavior. Remove the old selection and UUID-based conversion code with them.
4. Add source links for generated images in the current note, with a preview of intended changes.
5. Convert all plain PDF embeds in the current note.
6. Convert all plain PDF embeds across the vault, with a dry run and confirmation prompt.
7. Clean up remaining stale code and tests. Optimize only a measured bottleneck.

## Non-goals for now

- Automatically rewriting notes whenever a generated WebP is manually embedded.
- Adding every conceivable output-layout option before real usage identifies a need.
- Vault-wide source-link insertion for existing generated images. Users can add links while reviewing a note.
