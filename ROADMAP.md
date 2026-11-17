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
- Run lint, build, and unit tests as the development gate. The test suite covers rendering cleanup, settings repair, page validation, and provenance utilities.
- Repair invalid persisted settings and reject invalid output folders, image formats, quality values, layouts, and source-link settings.
- Release PDF, page, and canvas resources after every render attempt. Commands report one user-facing error when rendering or vault writes fail.
- Preserve provenance for a missing WebP while its source PDF exists, then recreate the image at the recorded path through refresh.
- Keep a PDF's existing output-folder variant when generating another page. New PDFs use the longer source-path ID; existing 8-character-ID folders remain supported.
- Expose only cursor-first conversion, contextual refresh, source-link repair, and index repair commands. Empty-folder cleanup lives in Settings.
- Resolve PDF and generated-WebP embeds through Obsidian from the active note before using paths for vault access or provenance. Adjacent source-link checks resolve their targets the same way.
- Serialize vault rename handling so consecutive source and generated-image moves run in order. Only output paths that match validated provenance move, while conflicts retain their original records.

An **Insert generated PDF page image** command is intentionally out of scope. Obsidian already makes it easy to embed an image directly, so this would add no meaningful UI benefit.

## Current workflow

Use `Convert PDF page embed at cursor` for page-specific PDF embeds. It is the only supported conversion workflow while cursor-first range and full-document conversion are being built.

The old selection and PDF-preview conversion code remains unregistered as a temporary migration bridge. Do not use or manually test it. It will be removed after `Convert PDF pages` and `Convert and insert PDF pages` replace its useful behaviour.

## Next: ordered work

1. Add manual migration to the current generated-image layout.
   - Add a Settings action, `Migrate generated images to current layout`, with a preview of moves, conflicts, missing images, and empty folders.
   - Move only existing WebPs through Obsidian's file rename mechanism so note embeds update with each file.
   - Require missing images to be refreshed first. Rebuild and refresh must never migrate layouts automatically.

2. Replace the selection-based conversion pipeline with the tested provenance-aware service.
   - Accept a plain PDF embed such as `![[Lectures/Week 03.pdf]]` for full-document and range conversion.
   - Treat `![[Lectures/Week 03.pdf#page=12]]` as a single-page conversion only. Do not offer range or full-document conversion for it.
   - Resolve the source from the cursor, select the requested pages, render or safely reuse each deterministic WebP, and record provenance for every page.
   - Return structured results so callers can distinguish rendered, reused, stale, skipped, and failed pages without guessing from notices.

3. Add two cursor commands for a plain PDF embed: `Convert PDF pages` and `Convert and insert PDF pages`.
   - Both commands use the same range prompt. Empty or whitespace-only input, and `full` in any letter case, select the full document.
   - Accept inclusive expressions such as `2-5` and `2, 5, 7-9`, preserving document order without duplicates.
   - `Convert PDF pages` creates or reuses images and records provenance without changing the note.
   - `Convert and insert PDF pages` replaces only the original plain PDF embed after every requested page has completed successfully. It follows the image-spacing setting.
   - A full-document insert places one source-PDF link above the image group, ignoring `sourceLinkPlacement`. A range insert places a page-specific link beside each image according to that setting.
   - Do not add an image-insertion command. Standard Obsidian embedding already covers that job.

4. Remove superseded commands and the UUID pipeline.
   - Remove the development-only render and inspect commands once the user-facing cursor commands cover their useful behaviour.
   - Remove the deprecated selection commands, preview-menu conversion, UUID output folders, the `uuid` dependency, and formatting code used only by that pipeline.
   - Confirm that no remaining command can create unindexed, non-deterministic generated images.

5. Add source links for generated images in the current note, with a preview of intended changes.
    - Resolve each generated image link before reading provenance.
    - Add only missing links and recognise an existing equivalent link even when it uses a relative path, custom label, or viewer parameters.
    - Show the proposed edits and require confirmation before changing the note.

6. Convert all plain PDF embeds in the current note.
    - Scan only plain PDF embeds, leave page-specific embeds alone, and present a preview with page counts, output paths, stale records, and conflicts.
    - Apply conversions as a deliberate confirmed operation. Avoid rewriting a note after a partial rendering failure.

7. Convert all plain PDF embeds across the vault.
    - Start with a dry run that reports affected notes, generated files, reused files, conflicts, and skipped embeds.
    - Require explicit confirmation, process notes predictably, and retain enough result detail to review or retry failures.

8. Review remaining code and tests after the old pipeline is gone.
    - Remove dead types, comments, dependencies, and duplicate formatting paths.
    - Add regression coverage for every cleanup defect fixed above.
    - Measure before changing rendering performance or adding output-layout options.

## Non-goals for now

- Automatically rewriting notes whenever a generated WebP is manually embedded.
- Adding every conceivable output-layout option before real usage identifies a need.
- Vault-wide source-link insertion for existing generated images. Users can add links while reviewing a note.
