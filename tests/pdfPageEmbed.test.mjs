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
			start: 7,
			end: 37,
			pdfPath: "PDFs/Landscape.pdf",
			pdfTarget: "PDFs/Landscape.pdf#page=7",
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
			start: 0,
			end: 33,
			pdfPath: "PDFs/Portrait.pdf",
			pdfTarget: "PDFs/Portrait.pdf#page=2",
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
			start: 0,
			end: 34,
			pdfPath: "PDFs/Portrait.pdf",
			pdfTarget: "PDFs/Portrait.pdf#page=2",
			pageNumber: 2,
			displayValue: "Test",
		},
	);
});

test("finds a page embed with documented PDF viewer parameters", () => {
	assert.deepEqual(
		findPdfPageEmbedAtCursor("![[PDFs/Portrait.pdf#page=2&height=400]]", 20),
		{
			embedText: "![[PDFs/Portrait.pdf#page=2&height=400]]",
			start: 0,
			end: 40,
			pdfPath: "PDFs/Portrait.pdf",
			pdfTarget: "PDFs/Portrait.pdf#page=2&height=400",
			pageNumber: 2,
			displayValue: null,
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
