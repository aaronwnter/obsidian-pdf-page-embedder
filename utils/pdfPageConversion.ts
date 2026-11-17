import type { GeneratedPageIndex, OutputPathStrategy } from "modules/types";
import {
	findGeneratedPageOutputPathForExistingLayout,
	findGeneratedPagePaths,
	hasGeneratedPageProvenance,
	isGeneratedPageStale,
} from "utils/generatedPageProvenance";
import { getPdfPageOutputPath } from "utils/pdfPageOutput";

export type PdfPageConversionStatus =
	| "rendered"
	| "reused"
	| "stale"
	| "skipped"
	| "failed";

export type PdfPageConversionResult = {
	pageNumber: number;
	status: PdfPageConversionStatus;
	outputPath?: string;
	reason?: string;
};

export type PdfPageConversionPlan =
	| { kind: "render"; pageNumber: number; outputPath: string }
	| { kind: "result"; result: PdfPageConversionResult };

type ExistingFile = {
	extension: string;
	mtime: number;
};

type PdfPageConversionContext = {
	pdfPath: string;
	sourceMtime: number;
	imageFolder: string;
	outputPathStrategy: OutputPathStrategy;
	generatedPages: GeneratedPageIndex;
	existingImagePaths: Set<string>;
	getFile: (path: string) => ExistingFile | null;
};

/**
 * Decides whether a PDF page can reuse an image or needs rendering. The plan
 * does not write files or mutate provenance.
 */
export function planPdfPageConversion(
	pageNumber: number,
	context: PdfPageConversionContext,
): PdfPageConversionPlan {
	const expectedOutputPath = getPdfPageOutputPath(
		context.imageFolder,
		context.pdfPath,
		pageNumber,
		context.outputPathStrategy,
	);
	const indexedOutputPath = findGeneratedPagePaths(
		context.generatedPages,
		context.pdfPath,
		pageNumber,
	).find((imagePath) => context.getFile(imagePath)?.extension === "webp") ?? null;
	const existingLayoutOutputPath = findGeneratedPageOutputPathForExistingLayout(
		context.generatedPages,
		context.existingImagePaths,
		context.imageFolder,
		context.pdfPath,
		pageNumber,
	);
	const expectedProvenance = context.generatedPages[expectedOutputPath];
	const expectedFile = context.getFile(expectedOutputPath);
	if (
		expectedProvenance &&
		!hasGeneratedPageProvenance(expectedProvenance, context.pdfPath, pageNumber) &&
		!expectedFile &&
		!indexedOutputPath &&
		!existingLayoutOutputPath
	) {
		return skipped(pageNumber, expectedOutputPath, "output path is reserved by a missing generated page");
	}
	const outputPath = indexedOutputPath ?? existingLayoutOutputPath ?? expectedOutputPath;
	if (
		outputPath === expectedOutputPath &&
		expectedProvenance &&
		!hasGeneratedPageProvenance(expectedProvenance, context.pdfPath, pageNumber) &&
		expectedFile?.extension === "webp"
	) {
		return skipped(pageNumber, outputPath, "output path belongs to another generated page");
	}

	const existingFile = context.getFile(outputPath);
	if (!existingFile) return { kind: "render", pageNumber, outputPath };
	if (existingFile.extension !== "webp") {
		return skipped(pageNumber, outputPath, "output path is already occupied");
	}
	const provenance = context.generatedPages[outputPath];
	if (!hasGeneratedPageProvenance(provenance, context.pdfPath, pageNumber)) {
		return skipped(pageNumber, outputPath, "output path is occupied by an unindexed image");
	}
	if (provenance && isGeneratedPageStale(provenance, context.sourceMtime, existingFile.mtime)) {
		return {
			kind: "result",
			result: {
				pageNumber,
				status: "stale",
				outputPath,
				reason: "source PDF changed",
			},
		};
	}
	return {
		kind: "result",
		result: { pageNumber, status: "reused", outputPath },
	};
}

function skipped(
	pageNumber: number,
	outputPath: string,
	reason: string,
): PdfPageConversionPlan {
	return {
		kind: "result",
		result: { pageNumber, status: "skipped", outputPath, reason },
	};
}
