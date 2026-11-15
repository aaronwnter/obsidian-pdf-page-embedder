import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/pdfPageRenderer.ts"], bundle: true, write: false, format: "esm",
});
const { renderPdfPages } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`,
);

function createPage(pageNumber, events, renderError) {
	return {
		getViewport: ({ scale }) => ({ width: pageNumber * scale, height: pageNumber * scale }),
		render: () => ({
			promise: renderError ? Promise.reject(renderError) : Promise.resolve(),
		}),
		cleanup: () => events.push(`page-${pageNumber}-cleanup`),
	};
}

function createDocument(events, renderError) {
	return {
		getPage: async (pageNumber) => {
			events.push(`page-${pageNumber}-get`);
			return createPage(pageNumber, events, renderError);
		},
		destroy: async () => events.push("document-destroy"),
	};
}

function createCanvasFactory(events, blob = new Blob(["webp"])) {
	return () => ({
		create: () => ({
			canvas: {
				toBlob: (resolve) => resolve(blob),
			},
			context: {},
		}),
		destroy: () => events.push("canvas-destroy"),
	});
}

test("renders only requested pages and releases resources after success", async () => {
	const events = [];
	const pages = await renderPdfPages(
		createDocument(events),
		[2, 4],
		0.5,
		createCanvasFactory(events),
	);

	assert.deepEqual(pages.map((page) => page.pageNumber), [2, 4]);
	assert.deepEqual(events, [
		"page-2-get", "page-2-cleanup", "canvas-destroy",
		"page-4-get", "page-4-cleanup", "canvas-destroy",
		"document-destroy",
	]);
});

test("releases the page, canvas, and document when rendering fails", async () => {
	const events = [];
	await assert.rejects(
		renderPdfPages(
			createDocument(events, new Error("render failed")),
			[1],
			0.5,
			createCanvasFactory(events),
		),
		/render failed/,
	);
	assert.deepEqual(events, ["page-1-get", "page-1-cleanup", "canvas-destroy", "document-destroy"]);
});

test("releases the page and document when canvas creation fails", async () => {
	const events = [];
	await assert.rejects(
		renderPdfPages(createDocument(events), [1], 0.5, () => ({
			create: () => ({ canvas: null, context: null }),
			destroy: () => events.push("canvas-destroy"),
		})),
		/Could not create a canvas/,
	);
	assert.deepEqual(events, ["page-1-get", "page-1-cleanup", "canvas-destroy", "document-destroy"]);
});
