import { App, Modal, Setting } from "obsidian";
import type { GeneratedPageMigrationPreview } from "utils/generatedPageMigration";

export class GeneratedImageMigrationModal extends Modal {
	constructor(
		app: App,
		private readonly preview: GeneratedPageMigrationPreview,
		private readonly onConfirmMigration: () => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Migrate generated images");
		const { contentEl } = this;
		contentEl.createEl("p", {
			text: "Review these changes before moving generated images to the current layout.",
		});
		this.renderList(
			"Images to move",
			this.preview.moves.map(({ imagePath, newImagePath }) =>
				`${imagePath} -> ${newImagePath}`,
			),
			"No generated images need to move.",
		);
		this.renderList(
			"Conflicts to leave unchanged",
			this.preview.conflicts.map(({ imagePath, newImagePath, reason }) =>
				`${imagePath} -> ${newImagePath} (${reason})`,
			),
			"No conflicts found.",
		);
		this.renderList(
			"Missing images that need refresh",
			this.preview.missingImages,
			"No recorded generated images are missing.",
		);
		this.renderList(
			"Folders to remove after migration",
			this.preview.emptyFolders,
			"No generated-image folders will become empty.",
		);

		if (this.preview.missingImages.length > 0) {
			contentEl.createEl("p", {
				text: "Refresh every missing image before migrating. No files can move yet.",
			});
		} else if (this.preview.moves.length > 0) {
			new Setting(contentEl)
				.addButton((button) => button
					.setButtonText(`Migrate ${this.preview.moves.length} image${this.preview.moves.length === 1 ? "" : "s"}`)
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						await this.onConfirmMigration();
						this.close();
					}));
		}
		new Setting(contentEl)
			.addButton((button) => button
				.setButtonText("Cancel")
				.onClick(() => this.close()));
	}

	private renderList(title: string, entries: string[], emptyText: string): void {
		this.contentEl.createEl("h3", { text: title });
		if (entries.length === 0) {
			this.contentEl.createEl("p", { text: emptyText });
			return;
		}
		const list = this.contentEl.createEl("ul");
		for (const entry of entries) list.createEl("li", { text: entry });
	}
}
