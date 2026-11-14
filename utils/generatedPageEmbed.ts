export type GeneratedPageEmbed = {
	embedText: string;
	start: number;
	end: number;
	imagePath: string;
};

const EMBED_PATTERN = /!\[\[([^\]\n]+)\]\]/g;

/**
 * Finds a WebP embed when the cursor is anywhere inside it.
 *
 * A pipe suffix is an Obsidian display value, rather than part of the file
 * path, so it is deliberately excluded from the path used for provenance.
 */
export function findGeneratedPageEmbedAtCursor(
	line: string,
	cursorCh: number,
): GeneratedPageEmbed | null {
	for (const match of line.matchAll(EMBED_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (cursorCh < start || cursorCh > end) continue;

		const [rawImagePath] = match[1].split("|", 1);
		const imagePath = rawImagePath.trim();
		if (!imagePath.toLowerCase().endsWith(".webp")) return null;

		return { embedText: match[0], start, end, imagePath };
	}

	return null;
}
