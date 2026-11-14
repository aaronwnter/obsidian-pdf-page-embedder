import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageEmbed.ts"], bundle: true, write: false, format: "esm",
});
const { findGeneratedPageEmbedAtCursor } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("finds a generated WebP embed anywhere under the cursor", () => {
	const line = "Before ![[PDF Page Images/Lecture-003.webp|400]] after";
	for (const cursorCh of [7, 11, 48]) {
		assert.deepEqual(findGeneratedPageEmbedAtCursor(line, cursorCh), {
			embedText: "![[PDF Page Images/Lecture-003.webp|400]]",
			start: 7,
			end: 48,
			imagePath: "PDF Page Images/Lecture-003.webp",
		});
	}
});

test("rejects non-WebP embeds and cursor positions outside the embed", () => {
	assert.equal(findGeneratedPageEmbedAtCursor("![[image.png]]", 5), null);
	assert.equal(findGeneratedPageEmbedAtCursor("![[image.webp]]", 20), null);
});
