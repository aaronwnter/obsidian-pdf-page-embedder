import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageProvenance.ts"], bundle: true, write: false, format: "esm",
});
const {
	findGeneratedPagePath,
	getGeneratedPageOutputStrategy,
	inferGeneratedPageOutputStrategy,
	isGeneratedPageStale,
	rebuildGeneratedPageProvenance,
	recordGeneratedPageProvenance,
	updateGeneratedPageProvenanceForRename,
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
