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
- A page embed with an image width, such as `![[PDFs/Portrait.pdf#page=2|600]]`.
- A plain PDF embed, to retain range-conversion coverage.
- A missing PDF and an out-of-range page, to verify helpful failures.
- The same direct-page conversion twice, to verify the image is reused.
- Two PDFs with the same filename in different folders, to verify no collisions.

Record the actual generated Markdown and asset path for each test before deciding whether another feature is needed.
