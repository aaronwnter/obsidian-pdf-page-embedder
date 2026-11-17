import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageProvenance.ts"], bundle: true, write: false, format: "esm",
});
const {
	findGeneratedPagePath,
	findGeneratedPageOutputPathForExistingLayout,
	getGeneratedPageOutputStrategy,
	inferGeneratedPageOutputStrategy,
	isGeneratedPageStale,
	moveGeneratedPageProvenanceForPdfRename,
	planGeneratedPageMovesForPdfRename,
	rebuildGeneratedPageProvenance,
	recordGeneratedPageProvenance,
	updateGeneratedPageProvenanceForRename,
	updateGeneratedPageImagePathsForRename,
} = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("records the source PDF page for a generated image", () => {
	assert.deepEqual(
		recordGeneratedPageProvenance(
			{},
			"Attachments/Portrait-003.webp",
			"PDFs/Nested/Portrait.pdf",
			3,
			"Test",
		),
		{
			"Attachments/Portrait-003.webp": {
				pdfPath: "PDFs/Nested/Portrait.pdf",
				pageNumber: 3,
				label: "Test",
			},
		},
	);
});

test("retains an existing label when a reused image has no new label", () => {
	const index = recordGeneratedPageProvenance(
		{}, "Attachments/Portrait-003.webp", "PDFs/Portrait.pdf", 3, "Lecture 3",
	);
	assert.equal(
		recordGeneratedPageProvenance(
			index, "Attachments/Portrait-003.webp", "PDFs/Portrait.pdf", 3, null,
		)["Attachments/Portrait-003.webp"].label,
		"Lecture 3",
	);
});

test("does not overwrite provenance owned by another PDF page", () => {
	const index = recordGeneratedPageProvenance(
		{}, "Attachments/Portrait-003.webp", "PDFs/Portrait.pdf", 3, null,
	);
	assert.equal(
		recordGeneratedPageProvenance(
			index,
			"Attachments/Portrait-003.webp",
			"PDFs/Another.pdf",
			3,
			null,
		),
		index,
	);
});

test("records the source modification time when rendering a page", () => {
	assert.equal(
		recordGeneratedPageProvenance(
			{}, "page.webp", "PDFs/Portrait.pdf", 3, null, 1_700_000_000,
		)["page.webp"].sourceMtime,
		1_700_000_000,
	);
});

test("updates provenance paths when a source folder or generated image moves", () => {
	const index = {
		"Generated/Old/Portrait-001.webp": {
			pdfPath: "PDFs/Old/Portrait.pdf",
			pageNumber: 1,
			label: null,
			sourceMtime: 10,
		},
	};
	const sourceRenamed = updateGeneratedPageProvenanceForRename(
		index, "PDFs/Old", "PDFs/New",
	);
	assert.equal(
		sourceRenamed["Generated/Old/Portrait-001.webp"].pdfPath,
		"PDFs/New/Portrait.pdf",
	);
	const imageRenamed = updateGeneratedPageProvenanceForRename(
		sourceRenamed, "Generated/Old", "Generated/New",
	);
	assert.equal(
		imageRenamed["Generated/New/Portrait-001.webp"].pdfPath,
		"PDFs/New/Portrait.pdf",
	);
});

test("retains a generated-image record when its rename destination already has provenance", () => {
	const index = {
		"Generated/Old/Portrait-001.webp": {
			pdfPath: "PDFs/Portrait.pdf", pageNumber: 1, label: null,
		},
		"Generated/New/Portrait-001.webp": {
			pdfPath: "PDFs/Other.pdf", pageNumber: 1, label: null,
		},
	};
	assert.deepEqual(
		updateGeneratedPageImagePathsForRename(index, "Generated/Old", "Generated/New"),
		{ generatedPages: index, conflicts: ["Generated/Old/Portrait-001.webp"] },
	);
});

test("finds recorded pages and detects changed sources without re-rendering", () => {
	const index = {
		"Generated/Portrait-001.webp": {
			pdfPath: "PDFs/Portrait.pdf",
			pageNumber: 1,
			label: null,
			sourceMtime: 10,
		},
	};
	const provenance = index["Generated/Portrait-001.webp"];
	assert.equal(findGeneratedPagePath(index, "PDFs/Portrait.pdf", 1), "Generated/Portrait-001.webp");
	assert.equal(isGeneratedPageStale(provenance, 10, 20), false);
	assert.equal(isGeneratedPageStale(provenance, 11, 20), true);
	assert.equal(isGeneratedPageStale({ ...provenance, sourceMtime: undefined }, 21, 20), true);
	assert.equal(isGeneratedPageStale({ ...provenance, sourceMtime: undefined }, 20, 21), false);
});

test("identifies a generated image layout so renames can preserve it", () => {
	assert.equal(
		getGeneratedPageOutputStrategy(
			"Attachments/Portrait--53e3e6a8/Portrait-002.webp",
			"Attachments",
			"PDFs/Portrait.pdf",
			2,
		),
		"shallow-source-id",
	);
	assert.equal(
		getGeneratedPageOutputStrategy(
			"Attachments/unrelated.webp",
			"Attachments",
			"PDFs/Portrait.pdf",
			2,
		),
		null,
	);
});

test("plans only generated images whose recorded source and output layout match a PDF rename", () => {
	const oldPdfPath = "PDFs/Portrait.pdf";
	const newPdfPath = "Archive/Portrait.pdf";
	const imagePath = "Attachments/Portrait--53e3e6a8/Portrait-002.webp";
	const index = {
		[imagePath]: {
			pdfPath: oldPdfPath, pageNumber: 2, label: null,
		},
		"Attachments/unrelated.webp": {
			pdfPath: oldPdfPath, pageNumber: 7, label: null,
		},
	};

	assert.deepEqual(
		planGeneratedPageMovesForPdfRename(
			index,
			"Attachments",
			oldPdfPath,
			newPdfPath,
		),
		{
			moves: [{
				imagePath,
				newImagePath: "Attachments/Portrait--a1f50911/Portrait-002.webp",
				pageNumber: 2,
			}],
			skipped: [{
				imagePath: "Attachments/unrelated.webp",
				reason: "output path does not match the recorded source",
			}],
		},
	);
});

test("updates one provenance record only after its generated image moves", () => {
	const imagePath = "Attachments/Portrait--53e3e6a8/Portrait-002.webp";
	const newImagePath = "Attachments/Portrait--a1f50911/Portrait-002.webp";
	const index = {
		[imagePath]: {
			pdfPath: "PDFs/Portrait.pdf", pageNumber: 2, label: "Page two",
		},
	};
	assert.deepEqual(
		moveGeneratedPageProvenanceForPdfRename(
			index,
			imagePath,
			newImagePath,
			"PDFs/Portrait.pdf",
			"Archive/Portrait.pdf",
		),
		{
			[newImagePath]: {
				pdfPath: "Archive/Portrait.pdf", pageNumber: 2, label: "Page two",
			},
		},
	);
	const destinationConflict = {
		...index,
		[newImagePath]: {
			pdfPath: "Archive/Other.pdf", pageNumber: 2, label: null,
		},
	};
	assert.equal(
		moveGeneratedPageProvenanceForPdfRename(
			destinationConflict,
			imagePath,
			newImagePath,
			"PDFs/Portrait.pdf",
			"Archive/Portrait.pdf",
		),
		destinationConflict,
	);
});

test("infers a historical layout after its source PDF has already moved", () => {
	assert.equal(
		inferGeneratedPageOutputStrategy(
			"Attachments/PDFs--Nested--Portrait--79248a2e/Portrait-005.webp",
			"Attachments",
		),
		"detailed-shallow-source-id",
	);
	assert.equal(
		inferGeneratedPageOutputStrategy(
			"Attachments/Portrait--79248a2e/Portrait-005.webp",
			"Attachments",
		),
		"shallow-source-id",
	);
	assert.equal(
		inferGeneratedPageOutputStrategy(
			"Attachments/PDFs/Nested/Portrait/Portrait-005.webp",
			"Attachments",
		),
		"mirror-source-path",
	);
});

test("rebuilds missing provenance from every generated-image layout", () => {
	const imageFolder = "Attachments/Images/PDF";
	const portraitPdf = "PDFs/Portrait.pdf";
	const nestedPortraitPdf = "PDFs/Nested/Portrait.pdf";
	const existingPath = "Attachments/Images/PDF/Portrait--53e3e6a8/Portrait-002.webp";
	const result = rebuildGeneratedPageProvenance(
		{
			[existingPath]: {
				pdfPath: portraitPdf,
				pageNumber: 2,
				label: "Existing label",
			},
		},
		[
			existingPath,
			"Attachments/Images/PDF/PDFs--Nested--Portrait--79248a2e/Portrait-005.webp",
			"Attachments/Images/PDF/PDFs/Portrait/Portrait-001.webp",
			"Attachments/Images/PDF/not-generated.webp",
		],
		[portraitPdf, nestedPortraitPdf],
		imageFolder,
	);

	assert.equal(result.added, 2);
	assert.equal(result.removed, 0);
	assert.deepEqual(result.generatedPages, {
		[existingPath]: {
			pdfPath: portraitPdf,
			pageNumber: 2,
			label: "Existing label",
		},
		"Attachments/Images/PDF/PDFs--Nested--Portrait--79248a2e/Portrait-005.webp": {
			pdfPath: nestedPortraitPdf,
			pageNumber: 5,
			label: null,
		},
		"Attachments/Images/PDF/PDFs/Portrait/Portrait-001.webp": {
			pdfPath: portraitPdf,
			pageNumber: 1,
			label: null,
		},
	});
});

test("prunes provenance records for missing images and source PDFs", () => {
	const result = rebuildGeneratedPageProvenance(
		{
			"Attachments/available.webp": {
				pdfPath: "PDFs/Available.pdf", pageNumber: 1, label: null,
			},
			"Attachments/missing-image.webp": {
				pdfPath: "PDFs/Available.pdf", pageNumber: 2, label: null,
			},
			"Attachments/missing-source.webp": {
				pdfPath: "PDFs/Missing.pdf", pageNumber: 1, label: null,
			},
		},
		["Attachments/available.webp", "Attachments/missing-source.webp"],
		["PDFs/Available.pdf"],
		"Attachments",
	);

	assert.equal(result.removed, 1);
	assert.equal(result.missingImages, 1);
	assert.deepEqual(result.generatedPages, {
		"Attachments/available.webp": {
			pdfPath: "PDFs/Available.pdf", pageNumber: 1, label: null,
		},
		"Attachments/missing-image.webp": {
			pdfPath: "PDFs/Available.pdf", pageNumber: 2, label: null,
		},
	});
});

test("uses an existing image layout for new pages but ignores missing images", () => {
	const index = {
		"Attachments/Landscape--0212b84c/Landscape-003.webp": {
			pdfPath: "PDFs/Landscape.pdf", pageNumber: 3, label: null,
		},
	};
	assert.equal(
		findGeneratedPageOutputPathForExistingLayout(
			index,
			new Set(["Attachments/Landscape--0212b84c/Landscape-003.webp"]),
			"Attachments",
			"PDFs/Landscape.pdf",
			7,
		),
		"Attachments/Landscape--0212b84c/Landscape-007.webp",
	);
	assert.equal(
		findGeneratedPageOutputPathForExistingLayout(
			index,
			new Set(),
			"Attachments",
			"PDFs/Landscape.pdf",
			7,
		),
		null,
	);
});
