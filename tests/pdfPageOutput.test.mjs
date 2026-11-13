import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageOutput.ts"], bundle: true, write: false, format: "esm",
});
const { getPdfPageOutputPath } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("creates readable output paths that mirror the source PDF location", () => {
	assert.equal(
		getPdfPageOutputPath("PDF Page Images", "PDFs/Nested/Portrait.pdf", 3),
		"PDF Page Images/PDFs/Nested/Portrait/Portrait-003.webp",
	);
});

test("uses at least three digits for a page number without truncating larger pages", () => {
	assert.equal(
		getPdfPageOutputPath("PDF Page Images", "PDFs/Landscape.pdf", 1002),
		"PDF Page Images/PDFs/Landscape/Landscape-1002.webp",
	);
});
