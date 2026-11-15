import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageRequest.ts"], bundle: true, write: false, format: "esm",
});
const { hasValidPdfPageNumbers } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`,
);

test("accepts requested PDF pages inside the document", () => {
	assert.equal(hasValidPdfPageNumbers([1, 3, 8], 8), true);
});

test("rejects empty, fractional, unsafe, and out-of-bounds requested pages", () => {
	for (const pages of [[], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1], [9]]) {
		assert.equal(hasValidPdfPageNumbers(pages, 8), false);
	}
});
