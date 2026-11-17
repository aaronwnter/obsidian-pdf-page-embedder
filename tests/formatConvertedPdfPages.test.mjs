import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/formatConvertedPdfPages.ts"], bundle: true, write: false, format: "esm",
});
const { formatConvertedPdfPages } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

const pages = [
	{ pageNumber: 1, outputPath: "Images/Portrait-001.webp" },
	{ pageNumber: 3, outputPath: "Images/Portrait-003.webp" },
];
const settings = {
	imageEmbedFormat: "![[${filename}]]",
	newlineBetweenPages: false,
	sourceLinkPlacement: "below",
};

test("puts one source link above a full-document image group", () => {
	assert.equal(
		formatConvertedPdfPages("PDFs/Portrait.pdf", pages, true, settings),
		"[[PDFs/Portrait.pdf]]\n![[Images/Portrait-001.webp]]\n![[Images/Portrait-003.webp]]",
	);
});

test("uses page-specific source links for an explicit range", () => {
	assert.equal(
		formatConvertedPdfPages("PDFs/Portrait.pdf", pages, false, settings),
		"![[Images/Portrait-001.webp]]\n[[PDFs/Portrait.pdf#page=1|Portrait.pdf — page 1]]\n![[Images/Portrait-003.webp]]\n[[PDFs/Portrait.pdf#page=3|Portrait.pdf — page 3]]",
	);
});
