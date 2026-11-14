import type { GeneratedPageIndex, OutputPathStrategy } from "modules/types";
import { getPdfPageOutputPath } from "utils/pdfPageOutput";

const OUTPUT_PATH_STRATEGIES: OutputPathStrategy[] = [
	"shallow-source-id",
	"detailed-shallow-source-id",
	"mirror-source-path",
];

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

function folderPath(path: string): string {
	return path.slice(0, path.lastIndexOf("/"));
}

function fileName(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1);
}

function imagePageNumber(imagePath: string, pdfPath: string): number | null {
	const pdfFileName = fileName(pdfPath).slice(0, -".pdf".length);
	const match = fileName(imagePath).match(
		new RegExp(`^${escapeRegExp(pdfFileName)}-(\\d+)\\.webp$`, "i"),
	);
	const pageNumber = match ? Number.parseInt(match[1], 10) : 0;
	return pageNumber > 0 ? pageNumber : null;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reconstructs missing provenance for generated WebPs in every historical
 * output layout. Existing records, including their labels, remain unchanged.
 */
export function rebuildGeneratedPageProvenance(
	existingIndex: GeneratedPageIndex,
	imagePaths: string[],
	pdfPaths: string[],
	imageFolder: string,
): { generatedPages: GeneratedPageIndex; added: number } {
	const imagesByFolder = new Map<string, string[]>();
	for (const imagePath of imagePaths) {
		const folder = folderPath(imagePath);
		const images = imagesByFolder.get(folder) ?? [];
		images.push(imagePath);
		imagesByFolder.set(folder, images);
	}

	const generatedPages = { ...existingIndex };
	let added = 0;
	for (const pdfPath of pdfPaths) {
		for (const strategy of OUTPUT_PATH_STRATEGIES) {
			const examplePath = getPdfPageOutputPath(
				imageFolder,
				pdfPath,
				1,
				strategy,
			);
			for (const imagePath of imagesByFolder.get(folderPath(examplePath)) ?? []) {
				if (generatedPages[imagePath]) continue;
				const pageNumber = imagePageNumber(imagePath, pdfPath);
				if (pageNumber === null) continue;
				if (
					getPdfPageOutputPath(imageFolder, pdfPath, pageNumber, strategy) !==
					imagePath
				) continue;

				generatedPages[imagePath] = {
					pdfPath,
					pageNumber,
					label: null,
				};
				added += 1;
			}
		}
	}

	return { generatedPages, added };
}
