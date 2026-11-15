import type {
	OutputPathStrategy,
	PdfPrinterSettings,
	SourceLinkPlacement,
} from "modules/types";

const OUTPUT_PATH_STRATEGIES = new Set<OutputPathStrategy>([
	"shallow-source-id",
	"detailed-shallow-source-id",
	"mirror-source-path",
]);

const SOURCE_LINK_PLACEMENTS = new Set<SourceLinkPlacement>([
	"none",
	"above",
	"below",
]);

function isVaultRelativeFolder(path: string): boolean {
	return path.length > 0 &&
		!path.startsWith("/") &&
		path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function validatePdfPrinterSettings(
	settings: PdfPrinterSettings,
): string | null {
	if (!isVaultRelativeFolder(settings.imageFolder)) {
		return "Choose a non-empty folder inside the vault.";
	}
	if (!OUTPUT_PATH_STRATEGIES.has(settings.outputPathStrategy)) {
		return "Choose a supported generated-image organization.";
	}
	if (
		!Number.isFinite(settings.imageQuality) ||
		settings.imageQuality < 0 ||
		settings.imageQuality > 1
	) {
		return "Image quality must be between 0 and 1.";
	}
	if (!settings.imageEmbedFormat.includes("${filename}")) {
		return "Image embed format must contain ${filename}.";
	}
	if (!SOURCE_LINK_PLACEMENTS.has(settings.sourceLinkPlacement)) {
		return "Choose a supported source-link placement.";
	}
	return null;
}

export function repairPdfPrinterSettings(
	savedSettings: Partial<PdfPrinterSettings>,
	defaultSettings: PdfPrinterSettings,
	normalizeFolder: (path: string) => string,
): { settings: PdfPrinterSettings; repaired: boolean } {
	const imageFolder = typeof savedSettings.imageFolder === "string"
		? normalizeFolder(savedSettings.imageFolder.trim())
		: defaultSettings.imageFolder;
	const settings: PdfPrinterSettings = {
		imageFolder: isVaultRelativeFolder(imageFolder)
			? imageFolder
			: defaultSettings.imageFolder,
		outputPathStrategy: OUTPUT_PATH_STRATEGIES.has(savedSettings.outputPathStrategy as OutputPathStrategy)
			? savedSettings.outputPathStrategy as OutputPathStrategy
			: defaultSettings.outputPathStrategy,
		imageQuality: typeof savedSettings.imageQuality === "number" &&
			Number.isFinite(savedSettings.imageQuality) &&
			savedSettings.imageQuality >= 0 &&
			savedSettings.imageQuality <= 1
			? savedSettings.imageQuality
			: defaultSettings.imageQuality,
		imageEmbedFormat: typeof savedSettings.imageEmbedFormat === "string" &&
			savedSettings.imageEmbedFormat.includes("${filename}")
			? savedSettings.imageEmbedFormat
			: defaultSettings.imageEmbedFormat,
		sourceLinkPlacement: SOURCE_LINK_PLACEMENTS.has(savedSettings.sourceLinkPlacement as SourceLinkPlacement)
			? savedSettings.sourceLinkPlacement as SourceLinkPlacement
			: defaultSettings.sourceLinkPlacement,
		newlineBetweenPages: typeof savedSettings.newlineBetweenPages === "boolean"
			? savedSettings.newlineBetweenPages
			: defaultSettings.newlineBetweenPages,
	};
	const repaired = Object.entries(settings).some(([key, value]) =>
		savedSettings[key as keyof PdfPrinterSettings] !== undefined &&
		savedSettings[key as keyof PdfPrinterSettings] !== value,
	);
	return { settings, repaired };
}
