import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageConversion.ts"], bundle: true, write: false, format: "esm",
});
const { planPdfPageConversion } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

const imagePath = "Attachments/Portrait--53e3e6a8/Portrait-002.webp";
const context = (overrides = {}) => {
	const generatedPages = {
		[imagePath]: {
			pdfPath: "PDFs/Portrait.pdf", pageNumber: 2, label: null, sourceMtime: 10,
		},
	};
	const files = new Map([[imagePath, { extension: "webp", mtime: 20 }]]);
	return {
		pdfPath: "PDFs/Portrait.pdf",
		sourceMtime: 10,
		imageFolder: "Attachments",
		outputPathStrategy: "shallow-source-id",
		generatedPages,
		existingImagePaths: new Set([imagePath]),
		getFile: (path) => files.get(path) ?? null,
		...overrides,
	};
};

test("reuses a fresh generated image with matching provenance", () => {
	assert.deepEqual(planPdfPageConversion(2, context()), {
		kind: "result",
		result: { pageNumber: 2, status: "reused", outputPath: imagePath },
	});
});

test("reports stale and occupied image paths without rendering", () => {
	assert.deepEqual(
		planPdfPageConversion(2, context({ sourceMtime: 11 })),
		{
			kind: "result",
			result: {
				pageNumber: 2,
				status: "stale",
				outputPath: imagePath,
				reason: "source PDF changed",
			},
		},
	);

	const occupiedPath = "Attachments/Portrait--10a93748607221/Portrait-001.webp";
	assert.deepEqual(
		planPdfPageConversion(1, context({
			generatedPages: {},
			existingImagePaths: new Set(),
			getFile: (path) => path === occupiedPath
				? { extension: "png", mtime: 10 }
				: null,
		})),
		{
			kind: "result",
			result: {
				pageNumber: 1,
				status: "skipped",
				outputPath: occupiedPath,
				reason: "output path is already occupied",
			},
		},
	);
});

test("plans a deterministic render when no reusable image exists", () => {
	assert.deepEqual(
		planPdfPageConversion(1, context({
			generatedPages: {},
			existingImagePaths: new Set(),
			getFile: () => null,
		})),
		{
			kind: "render",
			pageNumber: 1,
			outputPath: "Attachments/Portrait--10a93748607221/Portrait-001.webp",
		},
	);
});
