import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/plainPdfEmbed.ts"], bundle: true, write: false, format: "esm",
});
const { findPlainPdfEmbedAtCursor } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("finds a plain PDF embed and preserves its display value", () => {
	const line = "Before ![[Lectures/Week 03.pdf|Week three]] after";
	assert.deepEqual(findPlainPdfEmbedAtCursor(line, 18), {
		embedText: "![[Lectures/Week 03.pdf|Week three]]",
		start: 7,
		end: 43,
		pdfPath: "Lectures/Week 03.pdf",
		displayValue: "Week three",
	});
});

test("rejects page-specific PDFs, non-PDF embeds, and cursors outside an embed", () => {
	for (const [line, cursorCh] of [
		["![[Lectures/Week 03.pdf#page=2]]", 12],
		["![[image.webp]]", 8],
		["Before ![[Lectures/Week 03.pdf]] after", 0],
	]) {
		assert.equal(findPlainPdfEmbedAtCursor(line, cursorCh), null);
	}
});
