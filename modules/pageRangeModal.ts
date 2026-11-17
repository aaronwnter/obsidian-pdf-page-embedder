import { App, Modal, Notice, Setting } from "obsidian";
import { parsePdfPageSelection, PdfPageSelection } from "utils/pageRange";

class PageRangeModal extends Modal {
	private selection: PdfPageSelection | null = null;

	constructor(
		app: App,
		private pageCount: number,
		private resolve: (selection: PdfPageSelection | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Print PDF page ranges");
		let value = "";
		const submit = () => {
			try {
				this.selection = parsePdfPageSelection(value, this.pageCount);
			} catch {
				new Notice(`Enter pages between 1 and ${this.pageCount}, for example: 2-5, 7.`);
				return;
			}
			this.close();
		};
		new Setting(this.contentEl)
			.setName(`Pages (1–${this.pageCount})`)
			.addText((text) => {
			text.setPlaceholder("2-5, 7, or full").onChange((input) => { value = input; });
				text.inputEl.setAttribute("aria-label", "Page ranges");
				text.inputEl.focus();
			});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) => button.setButtonText("Print").setCta().onClick(submit));
		this.scope.register([], "Enter", () => { submit(); return false; });
	}

	onClose(): void {
		this.resolve(this.selection);
	}
}

export function promptForPageRange(app: App, pageCount: number): Promise<PdfPageSelection | null> {
	return new Promise((resolve) => new PageRangeModal(app, pageCount, resolve).open());
}
