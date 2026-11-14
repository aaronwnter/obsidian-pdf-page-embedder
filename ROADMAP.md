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

## Next: cursor-scoped workflow

- Add **Rebuild generated-image source index** for assets created before provenance tracking existed.

An **Insert generated PDF page image** command is intentionally out of scope. Obsidian already makes it easy to embed an image directly, so this would add no meaningful UI benefit.

## Later: broader scopes

- Add source links for generated images in the current note, with a preview of intended changes.
- Add source links for generated images across the vault, with dry-run, summary, and confirmation.
- Re-render or overwrite an existing page image when the source PDF changes.

## Non-goals for now

- Automatically rewriting notes whenever a generated WebP is manually embedded.
- Adding every conceivable output-layout option before real usage identifies a need.
