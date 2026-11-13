function withoutExtension(path: string): string {
	return path.slice(0, path.lastIndexOf("."));
}

/**
 * Builds a readable, deterministic image path for one PDF page.
 *
 * The PDF's vault-relative location is mirrored below the configured output
 * folder so identically named PDFs never collide.
 */
export function getPdfPageOutputPath(
	imageFolder: string,
	pdfPath: string,
	pageNumber: number,
): string {
	const pdfPathWithoutExtension = withoutExtension(pdfPath);
	const fileName = pdfPathWithoutExtension.slice(
		pdfPathWithoutExtension.lastIndexOf("/") + 1,
	);
	const paddedPage = String(pageNumber).padStart(3, "0");
	return `${imageFolder}/${pdfPathWithoutExtension}/${fileName}-${paddedPage}.webp`;
}
