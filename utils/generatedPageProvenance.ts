import type { GeneratedPageIndex } from "modules/types";

/**
 * Records the PDF-page origin of a generated image without discarding a label
 * already associated with that image.
 */
export function recordGeneratedPageProvenance(
	index: GeneratedPageIndex,
	imagePath: string,
	pdfPath: string,
	pageNumber: number,
	label: string | null,
): GeneratedPageIndex {
	const existing = index[imagePath];
	return {
		...index,
		[imagePath]: {
			pdfPath,
			pageNumber,
			label: label ?? existing?.label ?? null,
		},
	};
}
