import type {
	GeneratedPageIndex,
	OutputPathStrategy,
} from "modules/types";
import { getPdfPageOutputPath } from "utils/pdfPageOutput";

export type GeneratedPageMigrationMove = {
	imagePath: string;
	newImagePath: string;
	pdfPath: string;
	pageNumber: number;
};

export type GeneratedPageMigrationConflict = {
	imagePath: string;
	newImagePath: string;
	reason: "destination file already exists" | "destination already has provenance" | "another generated image has the same migration destination" | "recorded file is not a WebP image";
};

export type GeneratedPageMigrationPreview = {
	moves: GeneratedPageMigrationMove[];
	conflicts: GeneratedPageMigrationConflict[];
	missingImages: string[];
	emptyFolders: string[];
};

/**
 * Plans an explicit migration to the selected current output layout. It does
 * not mutate provenance or the vault.
 */
export function planGeneratedPageLayoutMigration(
	index: GeneratedPageIndex,
	imageFolder: string,
	outputPathStrategy: OutputPathStrategy,
	existingFilePaths: Set<string>,
	existingWebpPaths: Set<string>,
): GeneratedPageMigrationPreview {
	const moves: GeneratedPageMigrationMove[] = [];
	const conflicts: GeneratedPageMigrationConflict[] = [];
	const missingImages: string[] = [];
	const plannedDestinations = new Set<string>();
	for (const [imagePath, provenance] of Object.entries(index).sort(
		([left], [right]) => left.localeCompare(right),
	)) {
		if (!existingFilePaths.has(imagePath)) {
			missingImages.push(imagePath);
			continue;
		}
		const newImagePath = getPdfPageOutputPath(
			imageFolder,
			provenance.pdfPath,
			provenance.pageNumber,
			outputPathStrategy,
		);
		if (!existingWebpPaths.has(imagePath)) {
			conflicts.push({
				imagePath,
				newImagePath,
				reason: "recorded file is not a WebP image",
			});
			continue;
		}
		if (newImagePath === imagePath) continue;
		if (index[newImagePath]) {
			conflicts.push({ imagePath, newImagePath, reason: "destination already has provenance" });
			continue;
		}
		if (existingFilePaths.has(newImagePath)) {
			conflicts.push({ imagePath, newImagePath, reason: "destination file already exists" });
			continue;
		}
		if (plannedDestinations.has(newImagePath)) {
			conflicts.push({
				imagePath,
				newImagePath,
				reason: "another generated image has the same migration destination",
			});
			continue;
		}
		plannedDestinations.add(newImagePath);
		moves.push({
			imagePath,
			newImagePath,
			pdfPath: provenance.pdfPath,
			pageNumber: provenance.pageNumber,
		});
	}

	const remainingFilePaths = new Set(existingFilePaths);
	for (const { imagePath, newImagePath } of moves) {
		remainingFilePaths.delete(imagePath);
		remainingFilePaths.add(newImagePath);
	}
	const emptyFolders = foldersBelowRoot(existingFilePaths, imageFolder)
		.filter((folderPath) => ![...remainingFilePaths].some((filePath) =>
			filePath.startsWith(`${folderPath}/`),
		))
		.sort((left, right) => right.length - left.length || left.localeCompare(right));

	return { moves, conflicts, missingImages, emptyFolders };
}

function foldersBelowRoot(filePaths: Set<string>, rootPath: string): string[] {
	const folders = new Set<string>();
	for (const filePath of filePaths) {
		let folderPath = filePath.slice(0, filePath.lastIndexOf("/"));
		while (folderPath.startsWith(`${rootPath}/`)) {
			folders.add(folderPath);
			folderPath = folderPath.slice(0, folderPath.lastIndexOf("/"));
		}
	}
	return [...folders];
}
