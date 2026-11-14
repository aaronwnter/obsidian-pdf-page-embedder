import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageSourceLink.ts"], bundle: true, write: false, format: "esm",
});
const { formatPdfPageSourceLink, lineHasPdfPageSourceLink } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("formats a source link with an explicit or default label", () => {
	assert.equal(
		formatPdfPageSourceLink("PDFs/Portrait.pdf", 3, null),
		"[[PDFs/Portrait.pdf#page=3|Portrait.pdf — page 3]]",
	);
	assert.equal(
		formatPdfPageSourceLink("PDFs/Portrait.pdf", 3, "Lecture 3"),
		"[[PDFs/Portrait.pdf#page=3|Lecture 3]]",
	);
});

test("recognizes an equivalent PDF page link regardless of its label or viewer parameters", () => {
	assert.equal(
		lineHasPdfPageSourceLink(
			"See [[PDFs/Portrait.pdf#page=3&height=400|Custom label]].",
			"PDFs/Portrait.pdf",
			3,
		),
		true,
	);
	assert.equal(
		lineHasPdfPageSourceLink("[[PDFs/Portrait.pdf#page=2]]", "PDFs/Portrait.pdf", 3),
		false,
	);
});
