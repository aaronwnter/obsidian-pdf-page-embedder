export type PdfPageEmbed = {
	embedText: string;
	pdfPath: string;
	pageNumber: number;
	displayValue: string | null;
};

const EMBED_PATTERN = /!\[\[([^\]\n]+)\]\]/g;
const PDF_PAGE_TARGET_PATTERN = /^(.*\.pdf)#page=([1-9]\d*)$/i;

/**
 * Finds a standard PDF page embed when the cursor is anywhere inside it.
 *
 * This intentionally supports only `![[file.pdf#page=N]]` plus an optional
 * Obsidian embed width (`|600`) for the first page-embed workflow.
 */
export function findPdfPageEmbedAtCursor(
	line: string,
	cursorCh: number,
): PdfPageEmbed | null {
	for (const match of line.matchAll(EMBED_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (cursorCh < start || cursorCh > end) continue;

		const [target, rawDisplayValue] = match[1].split("|", 2);
		const pageMatch = target.trim().match(PDF_PAGE_TARGET_PATTERN);
		if (!pageMatch) return null;
		const displayValue = rawDisplayValue?.trim() || null;

		return {
			embedText: match[0],
			pdfPath: pageMatch[1],
			pageNumber: Number.parseInt(pageMatch[2], 10),
			displayValue,
		};
	}

	return null;
}
