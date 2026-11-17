import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageMigration.ts"], bundle: true, write: false, format: "esm",
});
const { planGeneratedPageLayoutMigration } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("plans layout moves and previews conflicts, missing images, and empty folders", () => {
	const root = "Attachments";
	const movableImage = "Attachments/PDFs/Old/Portrait/Portrait-001.webp";
	const missingImage = "Attachments/PDFs/Old/Portrait/Portrait-003.webp";
	const destination = "Attachments/Portrait--182bffbb97548f/Portrait-001.webp";
	const preview = planGeneratedPageLayoutMigration(
		{
			[movableImage]: {
				pdfPath: "PDFs/Old/Portrait.pdf", pageNumber: 1, label: null,
			},
			[missingImage]: {
				pdfPath: "PDFs/Old/Portrait.pdf", pageNumber: 3, label: null,
			},
		},
		root,
		"shallow-source-id",
		new Set([movableImage]),
		new Set([movableImage]),
	);

	assert.deepEqual(preview.moves, [{
		imagePath: movableImage,
		newImagePath: destination,
		pdfPath: "PDFs/Old/Portrait.pdf",
		pageNumber: 1,
	}]);
	assert.deepEqual(preview.missingImages, [missingImage]);
	assert.deepEqual(preview.conflicts, []);
	assert.deepEqual(preview.emptyFolders, [
		"Attachments/PDFs/Old/Portrait",
		"Attachments/PDFs/Old",
		"Attachments/PDFs",
	]);
});

test("does not plan moves that already use the current layout", () => {
	const imagePath = "Attachments/Portrait--182bffbb97548f/Portrait-001.webp";
	const preview = planGeneratedPageLayoutMigration(
		{
			[imagePath]: {
				pdfPath: "PDFs/Old/Portrait.pdf", pageNumber: 1, label: null,
			},
		},
		"Attachments",
		"shallow-source-id",
		new Set([imagePath]),
		new Set([imagePath]),
	);

	assert.deepEqual(preview, {
		moves: [],
		conflicts: [],
		missingImages: [],
		emptyFolders: [],
	});
});

test("reports a destination provenance conflict without planning a move", () => {
	const imagePath = "Attachments/PDFs/Old/Portrait/Portrait-002.webp";
	const destination = "Attachments/Portrait--182bffbb97548f/Portrait-002.webp";
	const preview = planGeneratedPageLayoutMigration(
		{
			[imagePath]: {
				pdfPath: "PDFs/Old/Portrait.pdf", pageNumber: 2, label: null,
			},
			[destination]: {
				pdfPath: "PDFs/Other.pdf", pageNumber: 2, label: null,
			},
		},
		"Attachments",
		"shallow-source-id",
		new Set([imagePath]),
		new Set([imagePath]),
	);

	assert.deepEqual(preview.moves, []);
	assert.deepEqual(preview.conflicts, [{
		imagePath,
		newImagePath: destination,
		reason: "destination already has provenance",
	}]);
});
