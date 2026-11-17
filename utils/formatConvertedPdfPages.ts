import type { PdfPrinterSettings } from "modules/types";
import { formatPdfPageEmbed } from "utils/formatPdfPageEmbed";

type ConvertedPdfPage = {
	pageNumber: number;
	outputPath: string;
};

/** Formats successfully converted pages for replacing one plain PDF embed. */
export function formatConvertedPdfPages(
	pdfPath: string,
	pages: ConvertedPdfPage[],
	isFullDocument: boolean,
	settings: Pick<
		PdfPrinterSettings,
		"imageEmbedFormat" | "newlineBetweenPages" | "sourceLinkPlacement"
	>,
): string {
	const separator = settings.newlineBetweenPages ? "\n\n" : "\n";
	if (isFullDocument) {
		const imageEmbeds = pages.map(({ outputPath }) =>
			settings.imageEmbedFormat.replace("${filename}", outputPath),
		).join(separator);
		return `[[${pdfPath}]]\n${imageEmbeds}`;
	}
	return pages.map(({ outputPath, pageNumber }) =>
		formatPdfPageEmbed(outputPath, pdfPath, pageNumber, null, settings),
	).join(separator);
}
