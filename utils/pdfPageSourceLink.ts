function defaultLinkText(pdfPath: string, pageNumber: number): string {
	const fileName = pdfPath.slice(pdfPath.lastIndexOf("/") + 1);
	return `${fileName} — page ${pageNumber}`;
}

/** Formats the page-specific PDF link used beside a generated image. */
export function formatPdfPageSourceLink(
	pdfPath: string,
	pageNumber: number,
	label: string | null,
): string {
	const linkText = label || defaultLinkText(pdfPath, pageNumber);
	return `[[${pdfPath}#page=${pageNumber}|${linkText}]]`;
}

const LINK_PATTERN = /\[\[([^\]\n]+)\]\]/g;

/**
 * Returns true when a line contains a link to the given PDF page. Links with
 * a custom label or additional PDF viewer parameters still count as matches.
 */
export function lineHasPdfPageSourceLink(
	line: string,
	pdfPath: string,
	pageNumber: number,
): boolean {
	for (const match of line.matchAll(LINK_PATTERN)) {
		const [rawTarget] = match[1].split("|", 1);
		const target = rawTarget.trim();
		const fragmentIndex = target.lastIndexOf("#");
		if (fragmentIndex === -1) continue;

		const linkedPdfPath = target.slice(0, fragmentIndex).trim();
		const linkedPage = new URLSearchParams(
			target.slice(fragmentIndex + 1),
		).get("page");
		if (linkedPdfPath === pdfPath && linkedPage === String(pageNumber)) return true;
	}

	return false;
}
