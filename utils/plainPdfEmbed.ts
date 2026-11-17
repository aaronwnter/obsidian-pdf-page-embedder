export type PlainPdfEmbed = {
	embedText: string;
	start: number;
	end: number;
	pdfPath: string;
	displayValue: string | null;
};

const EMBED_PATTERN = /!\[\[([^\]\n]+)\]\]/g;

/** Finds a plain PDF embed, excluding page-specific PDF viewer embeds. */
export function findPlainPdfEmbedAtCursor(
	line: string,
	cursorCh: number,
): PlainPdfEmbed | null {
	for (const match of line.matchAll(EMBED_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (cursorCh < start || cursorCh > end) continue;

		const [rawPath, rawDisplayValue] = match[1].split("|", 2);
		const pdfPath = rawPath.trim();
		if (!pdfPath.toLowerCase().endsWith(".pdf") || pdfPath.includes("#")) return null;
		return {
			embedText: match[0],
			start,
			end,
			pdfPath,
			displayValue: rawDisplayValue?.trim() || null,
		};
	}

	return null;
}
