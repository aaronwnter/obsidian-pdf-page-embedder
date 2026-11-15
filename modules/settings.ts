import PdfPrinterPlugin from "main";
import { PluginSettingTab, App, Notice, Setting, normalizePath } from "obsidian";
import { FolderSuggest } from "utils/suggest/folderSuggest";
import { validatePdfPrinterSettings } from "utils/settingsValidation";
import { PdfPrinterSettings } from "./types";

export const DEFAULT_SETTINGS: PdfPrinterSettings = {
	imageFolder: "PDF Page Images",
	outputPathStrategy: "shallow-source-id",
	imageQuality: 0.5,
	imageEmbedFormat: "![[${filename}]]",
	sourceLinkPlacement: "below",
	newlineBetweenPages: false,
};

export class PdfPrinterSettingsTab extends PluginSettingTab {
	plugin: PdfPrinterPlugin;

	constructor(app: App, plugin: PdfPrinterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const saveSettings = async (settings: PdfPrinterSettings): Promise<boolean> => {
			const validationError = validatePdfPrinterSettings(settings);
			if (validationError) {
				new Notice(validationError);
				return false;
			}
			this.plugin.settings = settings;
			await this.plugin.saveSettings();
			return true;
		};

		new Setting(this.containerEl)
			.setName("Printed image folder path")
			.setDesc("Place printed images from PDFs in this folder.")
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl);
				cb.setPlaceholder("Example: folder1/folder2")
					.setValue(this.plugin.settings.imageFolder);
				cb.inputEl.addEventListener("change", () => {
					void saveSettings({
						...this.plugin.settings,
						imageFolder: normalizePath(cb.inputEl.value.trim()),
					});
				});
			});

		const imageQualitySetting = new Setting(containerEl)
			.setName("Image quality")
			.setDesc(
				"Quality of the printed images. Higher values result in better quality but larger file sizes.",
			);
		const sizeHintText = (q: number) =>
			`${q} results in approx. ${(2.24 + (9.8 * q) / (q + 0.7) + 16.5 * q ** 20).toFixed(1)} MB per 100 slides.`; //approximated from 350 random lecture slides from my lectures
		const sizeHint = imageQualitySetting.descEl.createDiv({
			text: sizeHintText(this.plugin.settings.imageQuality),
		});

	new Setting(this.containerEl)
		.setName("Generated-image organization")
		.setDesc("Choose whether generated pages mirror the source path or use one shallow folder per source PDF.")
		.addDropdown((cb) => {
			cb.addOption(
				"shallow-source-id",
				"One folder per PDF (readable name + stable ID)",
			)
				.addOption(
					"detailed-shallow-source-id",
					"One folder per PDF (full source path + stable ID)",
				)
				.addOption(
					"mirror-source-path",
					"Mirror source PDF folders",
				)
				.setValue(this.plugin.settings.outputPathStrategy)
				.onChange(async (value) => {
					await saveSettings({
						...this.plugin.settings,
						outputPathStrategy: value as PdfPrinterSettings["outputPathStrategy"],
					});
				});
		});
		imageQualitySetting.addSlider((cb) => {
			cb.setLimits(0, 1, 0.01)
				.setInstant(true)
				.setValue(this.plugin.settings.imageQuality)
				.setDynamicTooltip()
				.onChange(async (value) => {
						if (await saveSettings({ ...this.plugin.settings, imageQuality: value })) {
							sizeHint.setText(sizeHintText(value));
						}
				});
		});

		new Setting(this.containerEl)
			.setName("Image embed format")
			.setDesc(
				"Format for embedding images in the markdown file. Use ${filename} as a placeholder for the image file name.",
			)
			.addText((cb) => {
				cb.setPlaceholder("![[${filename}]]")
						.setValue(this.plugin.settings.imageEmbedFormat);
					cb.inputEl.addEventListener("change", () => {
						void saveSettings({
							...this.plugin.settings,
							imageEmbedFormat: cb.inputEl.value,
						});
					});
			});

	new Setting(this.containerEl)
		.setName("Source PDF link placement")
		.setDesc("Keep a link to the original PDF above or below generated images, or omit it.")
		.addDropdown((cb) => {
			cb.addOption("none", "Do not add a source link")
				.addOption("above", "Above generated images")
				.addOption("below", "Below generated images")
				.setValue(this.plugin.settings.sourceLinkPlacement)
				.onChange(async (value) => {
					await saveSettings({
						...this.plugin.settings,
						sourceLinkPlacement: value as PdfPrinterSettings["sourceLinkPlacement"],
					});
				});
		});

		new Setting(this.containerEl)
			.setName("Newline between images")
			.setDesc(
				"Insert a newline between pasted images to allow for easier writing between images.",
			)
			.addToggle((cb) => {
				cb.setValue(this.plugin.settings.newlineBetweenPages).onChange(
					async (value) => {
						await saveSettings({ ...this.plugin.settings, newlineBetweenPages: value });
					},
				);
			});
	}
}
