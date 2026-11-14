import type { PdfPrinterSettings } from "modules/types";
import { formatPdfPageSourceLink } from "utils/pdfPageSourceLink";

export function formatPdfPageEmbed(
	imagePath: string,
	pdfPath: string,
	pageNumber: number,
	displayValue: string | null,
	settings: Pick<PdfPrinterSettings, "imageEmbedFormat" | "sourceLinkPlacement">,
): string {
	const imageEmbed = settings.imageEmbedFormat.replace("${filename}", imagePath);
	if (settings.sourceLinkPlacement === "none") return imageEmbed;

	const sourceLink = formatPdfPageSourceLink(pdfPath, pageNumber, displayValue);
	return settings.sourceLinkPlacement === "above"
		? `${sourceLink}\n${imageEmbed}`
		: `${imageEmbed}\n${sourceLink}`;
}
