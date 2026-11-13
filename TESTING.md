# Test vault checklist

Use only `/home/aaron/Documents/Projects/obsidian-pdf-page-embedder-test-vault` for manual Obsidian tests. Do not develop or test in the personal vault.

## Minimal fixtures

Add small, non-sensitive PDFs under `PDFs/`:

- `slides.pdf` with at least three pages.
- `nested/slides.pdf` with different content but the same filename.
- `names with spaces.pdf`.

## Manual cases

- A direct page embed for page 1 and a later page.
- A page embed with an image width, such as `![[PDFs/slides.pdf#page=2|600]]`.
- A plain PDF embed, to retain range-conversion coverage.
- A missing page number and a missing PDF, to verify helpful failures.
- The same direct-page conversion twice, to verify the image is reused.
- Two PDFs with the same filename in different folders, to verify no collisions.

Record the actual generated Markdown and asset path for each test before deciding whether another feature is needed.
