import type { OutputPathStrategy } from "modules/types";

function withoutExtension(path: string): string {
	return path.slice(0, path.lastIndexOf("."));
}

function sourcePathId(pdfPath: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < pdfPath.length; index += 1) {
		hash ^= pdfPath.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
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
	strategy: OutputPathStrategy,
): string {
	const pdfPathWithoutExtension = withoutExtension(pdfPath);
	const fileName = pdfPathWithoutExtension.slice(
		pdfPathWithoutExtension.lastIndexOf("/") + 1,
	);
	const paddedPage = String(pageNumber).padStart(3, "0");
	const outputFolder = strategy === "mirror-source-path"
		? `${imageFolder}/${pdfPathWithoutExtension}`
		: `${imageFolder}/${fileName}--${sourcePathId(pdfPath)}`;
	return `${outputFolder}/${fileName}-${paddedPage}.webp`;
}
