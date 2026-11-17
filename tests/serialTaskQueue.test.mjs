import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/serialTaskQueue.ts"], bundle: true, write: false, format: "esm",
});
const { SerialTaskQueue } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("runs queued tasks one at a time and continues after a failure", async () => {
	const queue = new SerialTaskQueue();
	const started = [];
	let releaseFirst;
	const first = queue.enqueue(async () => {
		started.push("first");
		await new Promise((resolve) => {
			releaseFirst = resolve;
		});
		throw new Error("first failed");
	});
	const second = queue.enqueue(async () => {
		started.push("second");
	});

	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(started, ["first"]);
	releaseFirst();
	await assert.rejects(first, /first failed/);
	await second;
	assert.deepEqual(started, ["first", "second"]);
});
