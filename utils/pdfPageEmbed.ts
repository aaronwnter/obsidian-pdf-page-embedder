export type PdfPageEmbed = {
	embedText: string;
	start: number;
	end: number;
	pdfPath: string;
	pdfTarget: string;
	pageNumber: number;
	displayValue: string | null;
};

type LinkDestination = {
	path: string;
};

type ResolveLinkpath = (
	linkpath: string,
	sourcePath: string,
) => LinkDestination | null;

const EMBED_PATTERN = /!\[\[([^\]\n]+)\]\]/g;

function parsePdfPageTarget(target: string): {
	pdfPath: string;
	pdfTarget: string;
	pageNumber: number;
} | null {
	const pdfTarget = target.trim();
	const fragmentIndex = pdfTarget.lastIndexOf("#");
	if (fragmentIndex === -1) return null;

	const pdfPath = pdfTarget.slice(0, fragmentIndex).trim();
	if (!pdfPath.toLowerCase().endsWith(".pdf")) return null;

	const page = new URLSearchParams(pdfTarget.slice(fragmentIndex + 1)).get("page");
	if (!page?.match(/^[1-9]\d*$/)) return null;

	return {
		pdfPath,
		pdfTarget,
		pageNumber: Number.parseInt(page, 10),
	};
}

/**
 * Finds a standard PDF page embed when the cursor is anywhere inside it.
 *
 * This supports a `#page=N` PDF fragment, optional PDF viewer parameters,
 * and an optional pipe display value.
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
		const pageTarget = parsePdfPageTarget(target);
		if (!pageTarget) return null;
		const displayValue = rawDisplayValue?.trim() || null;

		return {
			embedText: match[0],
			start,
			end,
			...pageTarget,
			displayValue,
		};
	}

	return null;
}

/** Resolves the PDF target before it is used as a vault path. */
export function resolvePdfPageEmbed(
	pageEmbed: PdfPageEmbed,
	sourcePath: string,
	resolveLinkpath: ResolveLinkpath,
): PdfPageEmbed | null {
	const file = resolveLinkpath(pageEmbed.pdfPath, sourcePath);
	if (!file) return null;

	return { ...pageEmbed, pdfPath: file.path };
}
