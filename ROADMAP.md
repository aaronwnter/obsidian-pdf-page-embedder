# Roadmap

This project is a personal, cursor-first fork of PDF Printer. The goal is to turn a PDF page embed into a reusable WebP image while retaining a reliable route back to the original PDF page.

## Branching and releases

`main` is the personal-use branch. Develop each roadmap item on a `feature/<topic>` or `dev/<topic>` branch, test it in the isolated vault, then commit it there. Merge an accepted feature into `main` only when the user asks to promote it. Bump `manifest.json` and `versions.json` only for an intentional release.

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
- Run lint, build, and unit tests as the development gate. The test suite covers rendering cleanup, settings repair, page validation, and provenance utilities.
- Repair invalid persisted settings and reject invalid output folders, image formats, quality values, layouts, and source-link settings.
- Release PDF, page, and canvas resources after every render attempt. Commands report one user-facing error when rendering or vault writes fail.
- Preserve provenance for a missing WebP while its source PDF exists, then recreate the image at the recorded path through refresh.
- Keep a PDF's existing output-folder variant when generating another page. New PDFs use the longer source-path ID; existing 8-character-ID folders remain supported.
- Expose cursor-first page conversion, plain-PDF range conversion and insertion, contextual refresh, source-link repair, and index repair commands. Empty-folder cleanup and layout migration live in Settings.
- Resolve PDF and generated-WebP embeds through Obsidian from the active note before using paths for vault access or provenance. Adjacent source-link checks resolve their targets the same way.
- Serialize vault rename handling so consecutive source and generated-image moves run in order. Only output paths that match validated provenance move, while conflicts retain their original records.
- Provide a confirmed Settings migration to the selected generated-image layout. It previews moves, conflicts, missing images, and empty folders. Refresh and index repair do not migrate layouts.
- Use a deterministic provenance-aware batch service for PDF-page rendering. It reports rendered, reused, stale, skipped, and failed pages, while the legacy selection pipeline remains unregistered until removal.
- Convert or insert pages from a plain PDF embed at the cursor. Range input supports empty and `full` for a full document, and insertions occur only after every selected page succeeds.

An **Insert generated PDF page image** command is intentionally out of scope. Obsidian already makes it easy to embed an image directly, so this would add no meaningful UI benefit.

## Current workflow

Use `Convert PDF page embed at cursor` for page-specific embeds. Use `Convert PDF pages` to render or reuse a plain PDF range without changing the note. Use `Convert and insert PDF pages` to replace a plain PDF embed after every requested page succeeds.

## Next: ordered work

1. Remove superseded commands and the UUID pipeline.
   - Keep only the commands listed in Current workflow and the supported Settings actions.
   - Remove the retired selection and preview conversion routes, UUID output folders, the `uuid` dependency, and formatting code used only by that pipeline.
   - Confirm that every remaining route records provenance and produces deterministic output paths.

2. Add source links for generated images in the current note, with a preview of intended changes.
    - Resolve each generated image link before reading provenance.
    - Add only missing links and recognise an existing equivalent link even when it uses a relative path, custom label, or viewer parameters.
    - Show the proposed edits and require confirmation before changing the note.

3. Convert all plain PDF embeds in the current note.
    - Scan only plain PDF embeds, leave page-specific embeds alone, and present a preview with page counts, output paths, stale records, and conflicts.
    - Apply conversions as a deliberate confirmed operation. Avoid rewriting a note after a partial rendering failure.

4. Convert all plain PDF embeds across the vault.
    - Start with a dry run that reports affected notes, generated files, reused files, conflicts, and skipped embeds.
    - Require explicit confirmation, process notes predictably, and retain enough result detail to review or retry failures.

5. Review remaining code and tests after the old pipeline is gone.
    - Remove dead types, comments, dependencies, and duplicate formatting paths.
    - Add regression coverage for every cleanup defect fixed above.
    - Measure before changing rendering performance or adding output-layout options.

## Non-goals for now

- Automatically rewriting notes whenever a generated WebP is manually embedded.
- Adding every conceivable output-layout option before real usage identifies a need.
- Vault-wide source-link insertion for existing generated images. Users can add links while reviewing a note.
