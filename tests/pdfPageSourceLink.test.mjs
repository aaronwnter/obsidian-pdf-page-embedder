import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageSourceLink.ts"], bundle: true, write: false, format: "esm",
});
const { formatPdfPageSourceLink, lineHasPdfPageSourceLink } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("formats a source link with an explicit or default label", () => {
	assert.equal(
		formatPdfPageSourceLink("PDFs/Portrait.pdf", 3, null),
		"[[PDFs/Portrait.pdf#page=3|Portrait.pdf — page 3]]",
	);
	assert.equal(
		formatPdfPageSourceLink("PDFs/Portrait.pdf", 3, "Lecture 3"),
		"[[PDFs/Portrait.pdf#page=3|Lecture 3]]",
	);
});

test("recognizes an equivalent PDF page link regardless of path form, label, or viewer parameters", () => {
	const sourcePath = "Notes/Project/meeting.md";
	const resolveLinkpath = (linkpath, source) => {
		assert.equal(source, sourcePath);
		const paths = {
			"PDFs/Portrait.pdf": "PDFs/Portrait.pdf",
			"Portrait.pdf": "Notes/Project/Portrait.pdf",
			"../PDFs/Portrait.pdf": "Notes/PDFs/Portrait.pdf",
		};
		return paths[linkpath] ? { path: paths[linkpath] } : null;
	};
	assert.equal(
		lineHasPdfPageSourceLink(
			"See [[PDFs/Portrait.pdf#page=3&height=400|Custom label]].",
			"PDFs/Portrait.pdf",
			3,
			sourcePath,
			resolveLinkpath,
		),
		true,
	);
	assert.equal(
		lineHasPdfPageSourceLink(
			"[[PDFs/Portrait.pdf#page=2]]",
			"PDFs/Portrait.pdf",
			3,
			sourcePath,
			resolveLinkpath,
		),
		false,
	);
	assert.equal(
		lineHasPdfPageSourceLink(
			"[[Portrait.pdf#page=3]]",
			"Notes/Project/Portrait.pdf",
			3,
			sourcePath,
			resolveLinkpath,
		),
		true,
	);
	assert.equal(
		lineHasPdfPageSourceLink(
			"[[../PDFs/Portrait.pdf#page=3]]",
			"Notes/PDFs/Portrait.pdf",
			3,
			sourcePath,
			resolveLinkpath,
		),
		true,
	);
});
