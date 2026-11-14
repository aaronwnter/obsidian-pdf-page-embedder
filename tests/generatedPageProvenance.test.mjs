import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageProvenance.ts"], bundle: true, write: false, format: "esm",
});
const { recordGeneratedPageProvenance, rebuildGeneratedPageProvenance } = await import(
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
