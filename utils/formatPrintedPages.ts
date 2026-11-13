import type { PdfPrinterSettings } from "../modules/types";

export function formatPrintedPages(
	pdfPath: string,
	imagePaths: string[],
	settings: Pick<
		PdfPrinterSettings,
		"imageEmbedFormat" | "sourceLinkPlacement" | "newlineBetweenPages"
	>,
): string {
	const newline = settings.newlineBetweenPages ? "\n\n" : "\n";
	const imageLinks = imagePaths.map((path) =>
		settings.imageEmbedFormat.replace("${filename}", path),
	).join(newline);
	const sourceLink = `[[${pdfPath}]]`;
	if (settings.sourceLinkPlacement === "above") {
		return `${sourceLink}\n${imageLinks}`;
	}
	if (settings.sourceLinkPlacement === "below") {
		return `\n${imageLinks}\n${sourceLink}`;
	}
	return `\n${imageLinks}`;
}
