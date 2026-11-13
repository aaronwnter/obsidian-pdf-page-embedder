import type { PdfPrinterSettings } from "modules/types";

function defaultLinkText(pdfPath: string, pageNumber: number): string {
	const fileName = pdfPath.slice(pdfPath.lastIndexOf("/") + 1);
	return `${fileName} — page ${pageNumber}`;
}

export function formatPdfPageEmbed(
	imagePath: string,
	pdfPath: string,
	pageNumber: number,
	displayValue: string | null,
	settings: Pick<PdfPrinterSettings, "imageEmbedFormat" | "sourceLinkPlacement">,
): string {
	const imageEmbed = settings.imageEmbedFormat.replace("${filename}", imagePath);
	if (settings.sourceLinkPlacement === "none") return imageEmbed;

	const linkText = displayValue || defaultLinkText(pdfPath, pageNumber);
	const sourceLink = `[[${pdfPath}#page=${pageNumber}|${linkText}]]`;
	return settings.sourceLinkPlacement === "above"
		? `${sourceLink}\n${imageEmbed}`
		: `${imageEmbed}\n${sourceLink}`;
}
