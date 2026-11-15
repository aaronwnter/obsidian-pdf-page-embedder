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

1. Restore the quality gate and define test seams before changing behaviour.
   - Replace the legacy ESLint configuration with a working ESLint 9 flat configuration, install or reference the matching TypeScript ESLint packages, and add `npm run lint`.
   - Keep `npm run build`, `npm test`, and lint green for every change.
   - Test conversion through a service boundary that can use a fake vault, editor, and PDF renderer. Utility-only tests are not enough for file creation, stale-image reuse, editor replacement, or rename behaviour.
   - Keep a small manual test matrix for the isolated vault: relative links, source edits, source moves, a deleted generated image, output-layout changes, and a failed render.

2. Validate settings and conversion inputs at the boundary.
   - Repair invalid persisted settings on load and reject invalid edits rather than carrying them into a render.
   - Require a non-empty vault-relative output folder, a known output strategy, image quality in the browser-supported range, and an image-embed format containing `${filename}`.
   - Validate every requested page as a positive integer within the source PDF page count, including pages read from provenance.
   - Treat malformed source embeds, unreadable PDFs, and invalid ranges as user-facing failures with no partial note edit.

3. Make PDF rendering safe to call repeatedly.
   - Extract rendering behind one service that loads only the requested pages and returns page number plus WebP bytes.
   - Release the PDF document, page resources, and canvas in `finally` blocks on success, cancellation, and failure.
   - Catch renderer and vault errors at the command boundary, log the technical error, and show one useful notice.
   - Do not write an output file or replace an embed until that page has rendered successfully.

4. Make generated-page provenance authoritative and self-healing.
   - Record provenance only after the WebP exists at the recorded path.
   - Remove index records whose image or source PDF no longer exists. Rebuilding the index must prune these records as well as discover missing ones.
   - When a generated file was deleted, render to the current deterministic path rather than reviving an old historical path from the index.
   - Reuse a WebP only when its provenance identifies the same source PDF and page. Report an occupied or conflicting path without overwriting its provenance.
   - Preserve existing labels during safe reuse, retain explicit stale-image behaviour, and cover stale, missing, duplicate, and conflicting records with tests.
   - Replace the 32-bit source-path ID with a collision-resistant identifier, or detect and resolve a collision before writing. The current short hash is not a no-collision guarantee.

5. Resolve all note links through Obsidian before looking up files or provenance.
   - Resolve relative PDF and generated-WebP embeds against the active note, then use the vault-relative resolved path everywhere else.
   - Apply this to page conversion, refresh, source-link insertion, duplicate-link detection, and future current-note scans.
   - Test embeds that use a full vault path, a bare filename, and `../` relative paths.

6. Serialize source and generated-image rename handling.
   - Process vault rename events through one queue so quick consecutive moves cannot race with index saves or image moves caused by the plugin itself.
   - Move only files whose validated provenance and output strategy agree with the rename.
   - Treat a destination file or index entry as a conflict, retain the original record, and report the skipped item.
   - After a successful move, update links through Obsidian, update provenance once, and clean only empty folders below the configured generated-image root.

7. Replace the selection-based conversion pipeline with the tested provenance-aware service.
   - Accept a plain PDF embed such as `![[Lectures/Week 03.pdf]]` for full-document and range conversion.
   - Treat `![[Lectures/Week 03.pdf#page=12]]` as a single-page conversion only. Do not offer range or full-document conversion for it.
   - Resolve the source from the cursor, select the requested pages, render or safely reuse each deterministic WebP, and record provenance for every page.
   - Return structured results so callers can distinguish rendered, reused, stale, skipped, and failed pages without guessing from notices.

8. Add two cursor commands for a plain PDF embed: `Convert PDF pages` and `Convert and insert PDF pages`.
   - Both commands use the same range prompt. Empty or whitespace-only input, and `full` in any letter case, select the full document.
   - Accept inclusive expressions such as `2-5` and `2, 5, 7-9`, preserving document order without duplicates.
   - `Convert PDF pages` creates or reuses images and records provenance without changing the note.
   - `Convert and insert PDF pages` replaces only the original plain PDF embed after every requested page has completed successfully. It follows the image-spacing setting.
   - A full-document insert places one source-PDF link above the image group, ignoring `sourceLinkPlacement`. A range insert places a page-specific link beside each image according to that setting.
   - Do not add an image-insertion command. Standard Obsidian embedding already covers that job.

9. Remove superseded commands and the UUID pipeline.
   - Remove the development-only render and inspect commands once the user-facing commands cover their useful behaviour.
   - Remove selection-based conversion, preview-menu conversion, UUID output folders, the `uuid` dependency, and formatting code used only by that pipeline.
   - Confirm that no remaining command can create unindexed, non-deterministic generated images.

10. Add source links for generated images in the current note, with a preview of intended changes.
    - Resolve each generated image link before reading provenance.
    - Add only missing links and recognise an existing equivalent link even when it uses a relative path, custom label, or viewer parameters.
    - Show the proposed edits and require confirmation before changing the note.

11. Convert all plain PDF embeds in the current note.
    - Scan only plain PDF embeds, leave page-specific embeds alone, and present a preview with page counts, output paths, stale records, and conflicts.
    - Apply conversions as a deliberate confirmed operation. Avoid rewriting a note after a partial rendering failure.

12. Convert all plain PDF embeds across the vault.
    - Start with a dry run that reports affected notes, generated files, reused files, conflicts, and skipped embeds.
    - Require explicit confirmation, process notes predictably, and retain enough result detail to review or retry failures.

13. Review remaining code and tests after the old pipeline is gone.
    - Remove dead types, comments, dependencies, and duplicate formatting paths.
    - Add regression coverage for every cleanup defect fixed above.
    - Measure before changing rendering performance or adding output-layout options.

## Non-goals for now

- Automatically rewriting notes whenever a generated WebP is manually embedded.
- Adding every conceivable output-layout option before real usage identifies a need.
- Vault-wide source-link insertion for existing generated images. Users can add links while reviewing a note.
