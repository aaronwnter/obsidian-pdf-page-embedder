import type { OutputPathStrategy } from "modules/types";

function withoutExtension(path: string): string {
	return path.slice(0, path.lastIndexOf("."));
}

function legacySourcePathId(pdfPath: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < pdfPath.length; index += 1) {
		hash ^= pdfPath.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

function sourcePathId(pdfPath: string): string {
	let first = 0xdeadbeef;
	let second = 0x41c6ce57;
	for (let index = 0; index < pdfPath.length; index += 1) {
		const character = pdfPath.charCodeAt(index);
		first = Math.imul(first ^ character, 2654435761);
		second = Math.imul(second ^ character, 1597334677);
	}
	first = Math.imul(first ^ (first >>> 16), 2246822507) ^
		Math.imul(second ^ (second >>> 13), 3266489909);
	second = Math.imul(second ^ (second >>> 16), 2246822507) ^
		Math.imul(first ^ (first >>> 13), 3266489909);
	const hash = 4294967296 * (2097151 & second) + (first >>> 0);
	return hash.toString(16).padStart(14, "0");
}

function getPdfPageOutputPathWithSourceId(
	imageFolder: string,
	pdfPath: string,
	pageNumber: number,
	strategy: OutputPathStrategy,
	sourceId: string,
): string {
	const pdfPathWithoutExtension = withoutExtension(pdfPath);
	const fileName = pdfPathWithoutExtension.slice(
		pdfPathWithoutExtension.lastIndexOf("/") + 1,
	);
	const paddedPage = String(pageNumber).padStart(3, "0");
	const outputFolder = strategy === "mirror-source-path"
		? `${imageFolder}/${pdfPathWithoutExtension}`
		: strategy === "detailed-shallow-source-id"
			? `${imageFolder}/${pdfPathWithoutExtension.split("/").join("--")}--${sourceId}`
			: `${imageFolder}/${fileName}--${sourceId}`;
	return `${outputFolder}/${fileName}-${paddedPage}.webp`;
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
	return getPdfPageOutputPathWithSourceId(
		imageFolder,
		pdfPath,
		pageNumber,
		strategy,
		sourcePathId(pdfPath),
	);
}

/** Includes the current output path and the historical short-ID variant. */
export function getPdfPageOutputPaths(
	imageFolder: string,
	pdfPath: string,
	pageNumber: number,
	strategy: OutputPathStrategy,
): string[] {
	const currentPath = getPdfPageOutputPath(
		imageFolder,
		pdfPath,
		pageNumber,
		strategy,
	);
	if (strategy === "mirror-source-path") return [currentPath];
	return [
		currentPath,
		getPdfPageOutputPathWithSourceId(
			imageFolder,
			pdfPath,
			pageNumber,
			strategy,
			legacySourcePathId(pdfPath),
		),
	];
}

/**
 * Reuses the current or historical output-folder variant that produced an
 * existing page for the same PDF.
 */
export function getPdfPageOutputPathForExistingLayout(
	existingImagePath: string,
	imageFolder: string,
	pdfPath: string,
	existingPageNumber: number,
	targetPageNumber: number,
	strategy: OutputPathStrategy,
): string | null {
	const existingPaths = getPdfPageOutputPaths(
		imageFolder,
		pdfPath,
		existingPageNumber,
		strategy,
	);
	const matchingPathIndex = existingPaths.indexOf(existingImagePath);
	if (matchingPathIndex === -1) return null;
	return getPdfPageOutputPaths(
		imageFolder,
		pdfPath,
		targetPageNumber,
		strategy,
	)[matchingPathIndex] ?? null;
}
