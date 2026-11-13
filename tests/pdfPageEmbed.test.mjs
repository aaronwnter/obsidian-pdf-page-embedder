import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageEmbed.ts"], bundle: true, write: false, format: "esm",
});
const { findPdfPageEmbedAtCursor } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("finds a PDF page embed from anywhere inside its range", () => {
	const line = "Before ![[PDFs/Landscape.pdf#page=7]] after";
	for (const cursorCh of [7, 10, 29, 36]) {
		assert.deepEqual(findPdfPageEmbedAtCursor(line, cursorCh), {
			embedText: "![[PDFs/Landscape.pdf#page=7]]",
			pdfPath: "PDFs/Landscape.pdf",
			pageNumber: 7,
			displayValue: null,
		});
	}
});

test("preserves a numeric display value without treating it as a PDF width", () => {
	assert.deepEqual(
		findPdfPageEmbedAtCursor("![[PDFs/Portrait.pdf#page=2|600]]", 28),
		{
			embedText: "![[PDFs/Portrait.pdf#page=2|600]]",
			pdfPath: "PDFs/Portrait.pdf",
			pageNumber: 2,
			displayValue: "600",
		},
	);
});

test("preserves a non-numeric display value", () => {
	assert.deepEqual(
		findPdfPageEmbedAtCursor("![[PDFs/Portrait.pdf#page=2|Test]]", 30),
		{
			embedText: "![[PDFs/Portrait.pdf#page=2|Test]]",
			pdfPath: "PDFs/Portrait.pdf",
			pageNumber: 2,
			displayValue: "Test",
		},
	);
});

test("rejects non-page embeds, invalid page numbers, and cursor positions outside an embed", () => {
	for (const [line, cursorCh] of [
		["![[PDFs/Portrait.pdf]]", 8],
		["![[PDFs/Portrait.pdf#page=0]]", 8],
		["![[PDFs/Portrait.pdf#page=two]]", 8],
		["Before ![[PDFs/Portrait.pdf#page=2]] after", 0],
	]) {
		assert.equal(findPdfPageEmbedAtCursor(line, cursorCh), null);
	}
});
