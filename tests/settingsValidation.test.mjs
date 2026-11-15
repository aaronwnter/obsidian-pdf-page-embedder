import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
	entryPoints: ["utils/settingsValidation.ts"], bundle: true, write: false, format: "esm",
});
const { repairPdfPrinterSettings, validatePdfPrinterSettings } = await import(
	`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`,
);

const defaults = {
	imageFolder: "PDF Page Images",
	outputPathStrategy: "shallow-source-id",
	imageQuality: 0.5,
	imageEmbedFormat: "![[${filename}]]",
	sourceLinkPlacement: "below",
	newlineBetweenPages: false,
};

test("repairs invalid persisted settings without changing valid settings", () => {
	const { settings, repaired } = repairPdfPrinterSettings({
		imageFolder: " /outside ",
		outputPathStrategy: "unknown",
		imageQuality: 2,
		imageEmbedFormat: "![[image.webp]]",
		sourceLinkPlacement: "sideways",
		newlineBetweenPages: true,
	}, defaults, (path) => path.trim());

	assert.equal(repaired, true);
	assert.deepEqual(settings, { ...defaults, newlineBetweenPages: true });
});

test("accepts valid vault-relative settings and rejects invalid edits", () => {
	const valid = { ...defaults, imageFolder: "Assets/PDF Pages", imageQuality: 1 };
	assert.equal(validatePdfPrinterSettings(valid), null);
	assert.match(validatePdfPrinterSettings({ ...valid, imageFolder: "" }), /non-empty/);
	assert.match(validatePdfPrinterSettings({ ...valid, imageFolder: "../Assets" }), /inside the vault/);
	assert.match(validatePdfPrinterSettings({ ...valid, imageQuality: Number.NaN }), /between 0 and 1/);
	assert.match(validatePdfPrinterSettings({ ...valid, imageEmbedFormat: "image.webp" }), /\$\{filename\}/);
});
