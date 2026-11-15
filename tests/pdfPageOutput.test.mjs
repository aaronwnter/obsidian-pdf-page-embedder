import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageOutput.ts"], bundle: true, write: false, format: "esm",
});
const { getPdfPageOutputPath, getPdfPageOutputPathForExistingLayout } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("creates readable output paths that mirror the source PDF location", () => {
	assert.equal(
		getPdfPageOutputPath(
			"PDF Page Images",
			"PDFs/Nested/Portrait.pdf",
			3,
			"mirror-source-path",
		),
		"PDF Page Images/PDFs/Nested/Portrait/Portrait-003.webp",
	);
});

test("creates a stable shallow folder per PDF", () => {
	const nestedPortrait = getPdfPageOutputPath(
		"PDF Page Images",
		"PDFs/Nested/Portrait.pdf",
		3,
		"shallow-source-id",
	);
	const topLevelPortrait = getPdfPageOutputPath(
		"PDF Page Images",
		"PDFs/Portrait.pdf",
		3,
		"shallow-source-id",
	);

	assert.match(
		nestedPortrait,
		/^PDF Page Images\/Portrait--[0-9a-f]{14}\/Portrait-003\.webp$/,
	);
	assert.notEqual(nestedPortrait, topLevelPortrait);
	assert.equal(
		nestedPortrait,
		getPdfPageOutputPath(
			"PDF Page Images",
			"PDFs/Nested/Portrait.pdf",
			3,
			"shallow-source-id",
		),
	);
});

test("can keep the full source path readable without nesting folders", () => {
	const outputPath = getPdfPageOutputPath(
		"PDF Page Images",
		"PDFs/Nested/Portrait.pdf",
		3,
		"detailed-shallow-source-id",
	);

	assert.match(
		outputPath,
		/^PDF Page Images\/PDFs--Nested--Portrait--[0-9a-f]{14}\/Portrait-003\.webp$/,
	);
});

test("uses at least three digits for a page number without truncating larger pages", () => {
	assert.match(
		getPdfPageOutputPath(
			"PDF Page Images",
			"PDFs/Landscape.pdf",
			1002,
			"shallow-source-id",
		),
		/^PDF Page Images\/Landscape--[0-9a-f]{14}\/Landscape-1002\.webp$/,
	);
});

test("keeps a new page in an existing historical output folder", () => {
	assert.equal(
		getPdfPageOutputPathForExistingLayout(
			"PDF Page Images/Landscape--0212b84c/Landscape-003.webp",
			"PDF Page Images",
			"PDFs/Landscape.pdf",
			3,
			7,
			"shallow-source-id",
		),
		"PDF Page Images/Landscape--0212b84c/Landscape-007.webp",
	);
});
