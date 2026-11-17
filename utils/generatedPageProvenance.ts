import type { GeneratedPageIndex, OutputPathStrategy } from "modules/types";
import {
	getPdfPageOutputPathForExistingLayout,
	getPdfPageOutputPaths,
} from "utils/pdfPageOutput";

const OUTPUT_PATH_STRATEGIES: OutputPathStrategy[] = [
	"shallow-source-id",
	"detailed-shallow-source-id",
	"mirror-source-path",
];

/**
 * Identifies the output layout that produced an image path. This lets a PDF
 * rename keep its existing layout while moving images to their new paths.
 */
export function getGeneratedPageOutputStrategy(
	imagePath: string,
	imageFolder: string,
	pdfPath: string,
	pageNumber: number,
): OutputPathStrategy | null {
	return OUTPUT_PATH_STRATEGIES.find((strategy) =>
		getPdfPageOutputPaths(imageFolder, pdfPath, pageNumber, strategy)
			.includes(imagePath),
	) ?? null;
}

/**
 * Infers a historical output layout from an existing image path. This repairs
 * images whose PDF was renamed before the plugin could move them.
 */
export function inferGeneratedPageOutputStrategy(
	imagePath: string,
	imageFolder: string,
): OutputPathStrategy | null {
	const folderPrefix = `${imageFolder}/`;
	if (!imagePath.startsWith(folderPrefix)) return null;
	const relativePath = imagePath.slice(folderPrefix.length);
	const separator = relativePath.lastIndexOf("/");
	const outputFolder = separator === -1 ? "" : relativePath.slice(0, separator);
	const imageFileName = separator === -1
		? relativePath
		: relativePath.slice(separator + 1);
	const match = imageFileName.match(/^(.+)-(\d+)\.webp$/i);
	if (!match) return null;
	const sourceFileName = match[1];
	const outputFolderName = outputFolder.slice(outputFolder.lastIndexOf("/") + 1);
	if (outputFolder && outputFolderName === sourceFileName) {
		return "mirror-source-path";
	}
	if (/--[0-9a-f]{8}(?:[0-9a-f]{6})?$/i.test(outputFolderName)) {
		return outputFolderName.startsWith(`${sourceFileName}--`)
			? "shallow-source-id"
			: "detailed-shallow-source-id";
	}
	return null;
}

export function hasGeneratedPageProvenance(
	provenance: GeneratedPageIndex[string] | undefined,
	pdfPath: string,
	pageNumber: number,
): boolean {
	return provenance?.pdfPath === pdfPath && provenance.pageNumber === pageNumber;
}

export type GeneratedPageRenameMove = {
	imagePath: string;
	newImagePath: string;
	pageNumber: number;
};

export type GeneratedPageRenameSkip = {
	imagePath: string;
	reason: "output path does not match the recorded source";
};

/**
 * Plans moves for a PDF rename only when each image belongs to the recorded
 * source PDF and its path matches one of that PDF's supported output layouts.
 */
export function planGeneratedPageMovesForPdfRename(
	index: GeneratedPageIndex,
	imageFolder: string,
	oldPdfPath: string,
	newPdfPath: string,
): {
	moves: GeneratedPageRenameMove[];
	skipped: GeneratedPageRenameSkip[];
} {
	const moves: GeneratedPageRenameMove[] = [];
	const skipped: GeneratedPageRenameSkip[] = [];
	for (const [imagePath, provenance] of Object.entries(index)) {
		if (provenance.pdfPath !== oldPdfPath) continue;
		const strategy = getGeneratedPageOutputStrategy(
			imagePath,
			imageFolder,
			oldPdfPath,
			provenance.pageNumber,
		);
		if (!strategy) {
			skipped.push({
				imagePath,
				reason: "output path does not match the recorded source",
			});
			continue;
		}
		const previousOutputPaths = getPdfPageOutputPaths(
			imageFolder,
			oldPdfPath,
			provenance.pageNumber,
			strategy,
		);
		const layoutIndex = previousOutputPaths.indexOf(imagePath);
		const newImagePath = getPdfPageOutputPaths(
			imageFolder,
			newPdfPath,
			provenance.pageNumber,
			strategy,
		)[layoutIndex];
		if (!newImagePath) {
			skipped.push({
				imagePath,
				reason: "output path does not match the recorded source",
			});
			continue;
		}
		moves.push({
			imagePath,
			newImagePath,
			pageNumber: provenance.pageNumber,
		});
	}
	return { moves, skipped };
}

/**
 * Moves one validated record after its WebP file has moved successfully.
 * Conflicts leave the existing index unchanged.
 */
export function moveGeneratedPageProvenanceForPdfRename(
	index: GeneratedPageIndex,
	imagePath: string,
	newImagePath: string,
	oldPdfPath: string,
	newPdfPath: string,
): GeneratedPageIndex {
	const provenance = index[imagePath];
	if (
		!provenance ||
		provenance.pdfPath !== oldPdfPath ||
		imagePath === newImagePath ||
		index[newImagePath]
	) return index;

	const remainingIndex = { ...index };
	delete remainingIndex[imagePath];
	return {
		...remainingIndex,
		[newImagePath]: { ...provenance, pdfPath: newPdfPath },
	};
}

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
	sourceMtime?: number,
): GeneratedPageIndex {
	const existing = index[imagePath];
	if (existing && !hasGeneratedPageProvenance(existing, pdfPath, pageNumber)) {
		return index;
	}
	const recordedSourceMtime = sourceMtime ?? existing?.sourceMtime;
	return {
		...index,
		[imagePath]: {
			pdfPath,
			pageNumber,
			label: label ?? existing?.label ?? null,
			...(recordedSourceMtime === undefined
				? {}
				: { sourceMtime: recordedSourceMtime }),
		},
	};
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string {
	if (path === oldPath) return newPath;
	return path.startsWith(`${oldPath}/`)
		? `${newPath}${path.slice(oldPath.length)}`
		: path;
}

/**
 * Updates generated-image paths and source paths after an Obsidian rename or
 * move. Image files stay in place when only their source PDF moves.
 */
export function updateGeneratedPageProvenanceForRename(
	index: GeneratedPageIndex,
	oldPath: string,
	newPath: string,
): GeneratedPageIndex {
	let changed = false;
	const updatedIndex: GeneratedPageIndex = {};
	for (const [imagePath, provenance] of Object.entries(index)) {
		const updatedImagePath = replacePathPrefix(imagePath, oldPath, newPath);
		const updatedPdfPath = replacePathPrefix(
			provenance.pdfPath,
			oldPath,
			newPath,
		);
		changed ||= updatedImagePath !== imagePath || updatedPdfPath !== provenance.pdfPath;
		updatedIndex[updatedImagePath] = updatedPdfPath === provenance.pdfPath
			? provenance
			: { ...provenance, pdfPath: updatedPdfPath };
	}
	return changed ? updatedIndex : index;
}

/**
 * Tracks a user-initiated generated-image rename without changing source PDF
 * paths. A destination index record is a conflict, so both records stay put.
 */
export function updateGeneratedPageImagePathsForRename(
	index: GeneratedPageIndex,
	oldPath: string,
	newPath: string,
): { generatedPages: GeneratedPageIndex; conflicts: string[] } {
	const movingImagePaths = new Set(
		Object.keys(index).filter((imagePath) =>
			imagePath === oldPath || imagePath.startsWith(`${oldPath}/`),
		),
	);
	const conflicts: string[] = [];
	let changed = false;
	const generatedPages: GeneratedPageIndex = {};
	for (const [imagePath, provenance] of Object.entries(index)) {
		const newImagePath = replacePathPrefix(imagePath, oldPath, newPath);
		if (
			newImagePath !== imagePath &&
			index[newImagePath] &&
			!movingImagePaths.has(newImagePath)
		) {
			conflicts.push(imagePath);
			generatedPages[imagePath] = provenance;
			continue;
		}
		changed ||= newImagePath !== imagePath;
		generatedPages[newImagePath] = provenance;
	}
	return {
		generatedPages: changed ? generatedPages : index,
		conflicts,
	};
}

/** Returns a recorded image for a PDF page, preferring a stable path order. */
export function findGeneratedPagePath(
	index: GeneratedPageIndex,
	pdfPath: string,
	pageNumber: number,
): string | null {
	return Object.keys(index).sort().find((imagePath) => {
		const provenance = index[imagePath];
		return provenance.pdfPath === pdfPath && provenance.pageNumber === pageNumber;
	}) ?? null;
}

export function findGeneratedPagePaths(
	index: GeneratedPageIndex,
	pdfPath: string,
	pageNumber: number,
): string[] {
	return Object.keys(index).sort().filter((imagePath) =>
		hasGeneratedPageProvenance(index[imagePath], pdfPath, pageNumber),
	);
}

/**
 * Returns the output path for a new page in the layout already used by an
 * existing image for the same PDF. Missing images do not choose a layout.
 */
export function findGeneratedPageOutputPathForExistingLayout(
	index: GeneratedPageIndex,
	existingImagePaths: Set<string>,
	imageFolder: string,
	pdfPath: string,
	targetPageNumber: number,
): string | null {
	for (const imagePath of Object.keys(index).sort()) {
		const provenance = index[imagePath];
		if (provenance.pdfPath !== pdfPath || !existingImagePaths.has(imagePath)) continue;
		for (const strategy of OUTPUT_PATH_STRATEGIES) {
			const targetPath = getPdfPageOutputPathForExistingLayout(
				imagePath,
				imageFolder,
				pdfPath,
				provenance.pageNumber,
				targetPageNumber,
				strategy,
			);
			if (targetPath) return targetPath;
		}
	}
	return null;
}

/**
 * Checks whether the source changed after this image was rendered. Older
 * index entries fall back to comparing the source and image modification time.
 */
export function isGeneratedPageStale(
	provenance: GeneratedPageIndex[string],
	sourceMtime: number,
	imageMtime: number,
): boolean {
	return provenance.sourceMtime !== undefined
		? provenance.sourceMtime !== sourceMtime
		: sourceMtime > imageMtime;
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
): {
	generatedPages: GeneratedPageIndex;
	added: number;
	missingImages: number;
	removed: number;
} {
	const imagesByFolder = new Map<string, string[]>();
	for (const imagePath of imagePaths) {
		const folder = folderPath(imagePath);
		const images = imagesByFolder.get(folder) ?? [];
		images.push(imagePath);
		imagesByFolder.set(folder, images);
	}

	const knownImages = new Set(imagePaths);
	const knownPdfs = new Set(pdfPaths);
	const generatedPages: GeneratedPageIndex = {};
	let removed = 0;
	let missingImages = 0;
	for (const [imagePath, provenance] of Object.entries(existingIndex)) {
		if (knownPdfs.has(provenance.pdfPath)) {
			generatedPages[imagePath] = provenance;
			if (!knownImages.has(imagePath)) missingImages += 1;
		} else {
			removed += 1;
		}
	}
	let added = 0;
	for (const pdfPath of pdfPaths) {
		for (const strategy of OUTPUT_PATH_STRATEGIES) {
			for (const examplePath of getPdfPageOutputPaths(
				imageFolder,
				pdfPath,
				1,
				strategy,
			)) {
				for (const imagePath of imagesByFolder.get(folderPath(examplePath)) ?? []) {
					if (generatedPages[imagePath]) continue;
					const pageNumber = imagePageNumber(imagePath, pdfPath);
					if (pageNumber === null) continue;
					if (!getPdfPageOutputPaths(
						imageFolder,
						pdfPath,
						pageNumber,
						strategy,
					).includes(imagePath)) continue;

					generatedPages[imagePath] = {
						pdfPath,
						pageNumber,
						label: null,
					};
					added += 1;
				}
			}
		}
	}

	return { generatedPages, added, missingImages, removed };
}
