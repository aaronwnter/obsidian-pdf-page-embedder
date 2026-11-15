# Test vault checklist

Use only `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder-test-vault` for manual Obsidian tests. Do not develop or test in the personal vault.

## Current fixtures

The test vault contains small, non-sensitive PDFs under `PDFs/`:

- `Example_PDF.pdf`: two US-letter portrait pages.
- `Landscape.pdf`: eight A4 landscape pages.
- `Portrait.pdf`: two A4 portrait pages.
- `Nested/Portrait.pdf`: five A4 portrait pages with the same filename as the top-level file.

## Manual cases

- A direct page embed for page 1 and a later page, using `Landscape.pdf`.
- A page embed with a display value, such as `![[PDFs/Portrait.pdf#page=2|Test]]`.
- A plain PDF embed, to retain range-conversion coverage.
- A missing PDF and an out-of-range page, to verify helpful failures.
- The same direct-page conversion twice, to verify the image is reused.
- Two PDFs with the same filename in different folders, to verify no collisions.
- A generated image embedded with a vault-relative path and with a `../` relative path. Source-link insertion and refresh must find the same provenance record in both cases.
- Edit a source PDF, confirm ordinary conversion reports the generated image as stale, then refresh it explicitly.
- Move or rename a source PDF and confirm its generated images move to the matching deterministic paths without breaking embeds in notes.
- Delete a generated WebP, run the relevant conversion again, and confirm it uses the current output layout rather than an obsolete indexed path.
- Change the output layout, convert another page, and confirm paths do not conflict with older generated files.
- Use a malformed, missing, or out-of-range PDF page embed and confirm the command reports the failure without changing the note or creating an image.

Record the actual generated Markdown and asset path for each test before deciding whether another feature is needed.
