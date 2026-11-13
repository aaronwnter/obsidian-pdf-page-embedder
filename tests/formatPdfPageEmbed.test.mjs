import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/formatPdfPageEmbed.ts"], bundle: true, write: false, format: "esm",
});
const { formatPdfPageEmbed } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

const settings = {
	imageEmbedFormat: "![[${filename}]]",
	sourceLinkPlacement: "below",
};

test("replaces a PDF page embed with an image and source link below", () => {
	assert.equal(
		formatPdfPageEmbed(
			"Attachments/Images/PDF/Portrait-003.webp",
			"PDFs/Nested/Portrait.pdf",
			3,
			null,
			settings,
		),
		"![[Attachments/Images/PDF/Portrait-003.webp]]\n[[PDFs/Nested/Portrait.pdf#page=3|Portrait.pdf — page 3]]",
	);
});

test("uses a display value as the source-link label and supports all placements", () => {
	const args = ["page.webp", "PDFs/Portrait.pdf", 2, "Test", settings];
	assert.equal(formatPdfPageEmbed(...args), "![[page.webp]]\n[[PDFs/Portrait.pdf#page=2|Test]]");
	assert.equal(
		formatPdfPageEmbed(...[...args.slice(0, 4), { ...settings, sourceLinkPlacement: "above" }]),
		"[[PDFs/Portrait.pdf#page=2|Test]]\n![[page.webp]]",
	);
	assert.equal(
		formatPdfPageEmbed(...[...args.slice(0, 4), { ...settings, sourceLinkPlacement: "none" }]),
		"![[page.webp]]",
	);
});
