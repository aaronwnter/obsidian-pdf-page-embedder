import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageProvenance.ts"], bundle: true, write: false, format: "esm",
});
const { recordGeneratedPageProvenance } = await import(
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
