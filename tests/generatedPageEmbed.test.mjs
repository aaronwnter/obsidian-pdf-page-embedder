import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/generatedPageEmbed.ts"], bundle: true, write: false, format: "esm",
});
const { findGeneratedPageEmbedAtCursor, resolveGeneratedPageEmbedAtCursor } = await import(
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

test("resolves generated WebP embeds to vault paths from the active note", () => {
	const sourcePath = "Notes/Project/meeting.md";
	const resolvedPaths = new Map([
		["PDF Page Images/Lecture-003.webp", "PDF Page Images/Lecture-003.webp"],
		["Lecture-003.webp", "Notes/Project/Lecture-003.webp"],
		["../Generated/Lecture-003.webp", "Notes/Generated/Lecture-003.webp"],
	]);
	const resolveLinkpath = (linkpath, source) => {
		assert.equal(source, sourcePath);
		const path = resolvedPaths.get(linkpath);
		return path ? { path } : null;
	};

	for (const [linkpath, imagePath] of resolvedPaths) {
		assert.deepEqual(
			resolveGeneratedPageEmbedAtCursor(
				`![[${linkpath}]]`,
				5,
				sourcePath,
				resolveLinkpath,
			),
			{
				embedText: `![[${linkpath}]]`,
				start: 0,
				end: linkpath.length + 5,
				imagePath,
			},
		);
	}
});
