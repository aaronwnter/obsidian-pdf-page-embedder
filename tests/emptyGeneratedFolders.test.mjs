import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/emptyGeneratedFolders.ts"], bundle: true, write: false, format: "esm",
});
const { findEmptyGeneratedFolderPaths } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("lists only empty descendants of the configured generated-image folder", () => {
	const root = {
		path: "Attachments/Images/PDF",
		children: [
			{
				path: "Attachments/Images/PDF/Old",
				children: [
					{
						path: "Attachments/Images/PDF/Old/Nested",
						children: [],
					},
				],
			},
			{
				path: "Attachments/Images/PDF/Used",
				children: [{ path: "Attachments/Images/PDF/Used/page.webp" }],
			},
		],
	};

	assert.deepEqual(findEmptyGeneratedFolderPaths(root), [
		"Attachments/Images/PDF/Old/Nested",
		"Attachments/Images/PDF/Old",
	]);
});
