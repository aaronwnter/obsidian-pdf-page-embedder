import { BrowserCanvasFactory } from "utils/canvas/canvasFactory";
import { findEmptyGeneratedFolderPaths, FolderTree } from "utils/emptyGeneratedFolders";
import { formatPdfPageEmbed } from "utils/formatPdfPageEmbed";
import { formatPrintedPages } from "utils/formatPrintedPages";
import { resolveGeneratedPageEmbedAtCursor } from "utils/generatedPageEmbed";
import {
	findGeneratedPagePaths,
	findGeneratedPageOutputPathForExistingLayout,
	getGeneratedPageOutputStrategy,
	hasGeneratedPageProvenance,
	inferGeneratedPageOutputStrategy,
	isGeneratedPageStale,
	rebuildGeneratedPageProvenance,
	recordGeneratedPageProvenance,
	updateGeneratedPageProvenanceForRename,
} from "utils/generatedPageProvenance";
import {
	formatPdfPageSourceLink,
	lineHasPdfPageSourceLink,
} from "utils/pdfPageSourceLink";
import {
	findPdfPageEmbedAtCursor,
	PdfPageEmbed,
	resolvePdfPageEmbed,
} from "utils/pdfPageEmbed";
import { getPdfPageOutputPath } from "utils/pdfPageOutput";
import { hasValidPdfPageNumbers } from "utils/pdfPageRequest";
import { renderPdfPages } from "utils/pdfPageRenderer";
import { repairPdfPrinterSettings } from "utils/settingsValidation";
import {
	Editor,
	MarkdownView,
	normalizePath,
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	TFolder,
	loadPdfJs,
} from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_SETTINGS, PdfPrinterSettingsTab } from "modules/settings";
import { promptForPageRange } from "modules/pageRangeModal";
import {
	GeneratedPageIndex,
	PdfDocumentBuffer,
	PdfPage,
	PdfPrinterSettings,
} from "modules/types";

type PluginData = Partial<PdfPrinterSettings> & {
	generatedPages?: GeneratedPageIndex;
};

type LegacyPluginData = PluginData & {
	preservePdfLink?: boolean;
};

export default class PdfPrinterPlugin extends Plugin {
	settings!: PdfPrinterSettings;
	generatedPages: GeneratedPageIndex = {};

	async onload() {
		await this.loadSettings();
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			void this.updateGeneratedPageProvenanceForRename(file, oldPath);
		}));
		this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
			if (!(file instanceof TFile) || file.extension !== "pdf") return;
			menu.addItem((item) => item
				.setTitle("PDF Page Embedder: Refresh generated pages")
				.setIcon("refresh-cw")
				.onClick(() => this.runPdfCommand(() => this.refreshGeneratedPagesForPdf(file))));
		}));

		this.addCommand({
			id: "convert-pdf-page-embed-at-cursor",
			name: "Convert PDF page embed at cursor",
			editorCallback: (editor: Editor) => this.runPdfCommand(() => this.convertPdfPageEmbedAtCursor(editor)),
		});
		this.addCommand({
			id: "refresh-generated-pdf-images",
			name: "Refresh generated PDF image(s)",
			checkCallback: (checking) => {
				if (!this.canRefreshGeneratedPdfImages()) return false;
				if (!checking) this.runPdfCommand(() => this.refreshGeneratedPdfImages());
				return true;
			},
		});
		this.addCommand({
			id: "add-source-link-for-generated-image-at-cursor",
			name: "Add source link for generated image at cursor",
			editorCallback: (editor: Editor) => this.addSourceLinkForGeneratedImageAtCursor(editor),
		});
		this.addCommand({
			id: "rebuild-generated-image-source-index",
			name: "Repair generated-image index",
			callback: () => this.runPdfCommand(() => this.rebuildGeneratedImageSourceIndex()),
		});
		this.addSettingTab(new PdfPrinterSettingsTab(this.app, this));
	}

	private runPdfCommand(command: () => Promise<void>): void {
		void command().catch((error) => {
			console.error("pdf-page-embedder: command failed", error);
			new Notice("Could not process the PDF. See the console for details.");
		});
	}

	private async printSelection(editor: Editor, promptForRange = false): Promise<void> {
		const pdfFile = this.fetchFileFromMdPath(editor.getSelection());
		if (!pdfFile) return;
		const printedText = await this.printPdf(pdfFile, promptForRange);
		if (printedText === null) return;
		editor.replaceSelection(printedText);
		new Notice(`Document '${pdfFile.name}' was printed successfully.`);
	}

	private inspectPdfPageEmbedAtCursor(editor: Editor): void {
		const resolvedEmbed = this.resolvePdfPageEmbedAtCursor(editor);
		if (!resolvedEmbed) return;
		const { file, pageEmbed } = resolvedEmbed;

		const displayValue = pageEmbed.displayValue
			? `, display ${pageEmbed.displayValue}`
			: "";
		new Notice(
			`Found ${file.path}, page ${pageEmbed.pageNumber}${displayValue}.`,
		);
	}

	private async renderPdfPageEmbedAtCursor(editor: Editor): Promise<void> {
		const resolvedEmbed = this.resolvePdfPageEmbedAtCursor(editor);
		if (!resolvedEmbed) return;
		const { file, pageEmbed } = resolvedEmbed;
		const renderedPage = await this.getOrRenderPdfPage(
			file,
			pageEmbed.pageNumber,
			pageEmbed.displayValue,
		);
		if (!renderedPage) return;
		new Notice(
			renderedPage.reused
				? `Reusing ${renderedPage.outputPath}.`
				: `Rendered page ${pageEmbed.pageNumber} to ${renderedPage.outputPath}.`,
		);
	}

	private async convertPdfPageEmbedAtCursor(editor: Editor): Promise<void> {
		const resolvedEmbed = this.resolvePdfPageEmbedAtCursor(editor);
		if (!resolvedEmbed) return;
		const { file, pageEmbed } = resolvedEmbed;
		const cursor = editor.getCursor();
		const renderedPage = await this.getOrRenderPdfPage(
			file,
			pageEmbed.pageNumber,
			pageEmbed.displayValue,
		);
		if (!renderedPage) return;

		const currentLine = editor.getLine(cursor.line);
		if (currentLine.slice(pageEmbed.start, pageEmbed.end) !== pageEmbed.embedText) {
			new Notice("The PDF embed changed before it could be replaced.");
			return;
		}

		const replacement = formatPdfPageEmbed(
			renderedPage.outputPath,
			file.path,
			pageEmbed.pageNumber,
			pageEmbed.displayValue,
			this.settings,
		);
		editor.replaceRange(
			replacement,
			{ line: cursor.line, ch: pageEmbed.start },
			{ line: cursor.line, ch: pageEmbed.end },
		);
		new Notice(
			renderedPage.reused
				? "Reused the page image and replaced the PDF embed."
				: "Rendered the page image and replaced the PDF embed.",
		);
	}

	private addSourceLinkForGeneratedImageAtCursor(editor: Editor): void {
		if (this.settings.sourceLinkPlacement === "none") {
			new Notice("Source-link placement is set to none.");
			return;
		}

		const cursor = editor.getCursor();
		const pageEmbed = this.resolveGeneratedPageEmbedAtCursor(editor);
		if (!pageEmbed) {
			new Notice("Place the cursor inside a resolvable generated WebP embed.");
			return;
		}

		const provenance = this.generatedPages[normalizePath(pageEmbed.imagePath)];
		if (!provenance) {
			new Notice("No source PDF page is recorded for this WebP image.");
			return;
		}

		const previousLine = cursor.line > 0
			? editor.getLine(cursor.line - 1)
			: "";
		const nextLine = cursor.line < editor.lineCount() - 1
			? editor.getLine(cursor.line + 1)
			: "";
		const sourcePath = this.activeNotePath();
		if (
			lineHasPdfPageSourceLink(
				previousLine,
				provenance.pdfPath,
				provenance.pageNumber,
				sourcePath,
				this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache),
			) || lineHasPdfPageSourceLink(
				nextLine,
				provenance.pdfPath,
				provenance.pageNumber,
				sourcePath,
				this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache),
			)
		) {
			new Notice("A source link is already adjacent to this image.");
			return;
		}

		const sourceLink = formatPdfPageSourceLink(
			provenance.pdfPath,
			provenance.pageNumber,
			provenance.label,
		);
		if (this.settings.sourceLinkPlacement === "above") {
			editor.replaceRange(`${sourceLink}\n`, {
				line: cursor.line,
				ch: pageEmbed.start,
			});
		} else {
			editor.replaceRange(`\n${sourceLink}`, {
				line: cursor.line,
				ch: pageEmbed.end,
			});
		}
		new Notice("Added the source PDF page link.");
	}

	private async refreshGeneratedPdfPageAtCursor(editor: Editor): Promise<void> {
		const pageEmbed = this.resolveGeneratedPageEmbedAtCursor(editor);
		if (!pageEmbed) {
			new Notice("Place the cursor inside a resolvable generated WebP embed.");
			return;
		}

		const imagePath = normalizePath(pageEmbed.imagePath);
		const provenance = this.generatedPages[imagePath];
		const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
		const sourceFile = provenance
			? this.app.vault.getFileByPath(provenance.pdfPath)
			: null;
		if (
			!provenance ||
			(imageFile !== null && (!(imageFile instanceof TFile) || imageFile.extension !== "webp"))
		) {
			new Notice("No generated PDF page is recorded for this WebP image.");
			return;
		}
		if (!sourceFile || sourceFile.extension !== "pdf") {
			new Notice(`Source PDF not found: ${provenance.pdfPath}`);
			return;
		}

		await this.refreshGeneratedPagesForPdf(sourceFile, [imagePath]);
	}

	private canRefreshGeneratedPdfImages(): boolean {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile?.extension === "pdf") return true;
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView?.file) return false;
		return this.resolveGeneratedPageEmbedAtCursor(activeView.editor) !== null;
	}

	private async refreshGeneratedPdfImages(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile?.extension === "pdf") {
			await this.refreshGeneratedPagesForPdf(activeFile);
			return;
		}
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView?.file) await this.refreshGeneratedPdfPageAtCursor(activeView.editor);
	}

	private async refreshGeneratedPagesForActivePdf(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "pdf") {
			new Notice("Open a PDF file to refresh its generated pages.");
			return;
		}
		await this.refreshGeneratedPagesForPdf(activeFile);
	}

	private async refreshGeneratedPagesForPdf(
		file: TFile,
		imagePaths?: string[],
	): Promise<void> {
		const migration = { moved: 0, skipped: 0 };
		const requestedPaths = imagePaths ? new Set(imagePaths) : null;
		const pagesToRefresh = Object.entries(this.generatedPages).filter(
			([imagePath, provenance]) =>
				provenance.pdfPath === file.path &&
				(!requestedPaths || requestedPaths.has(imagePath)),
		);
		if (pagesToRefresh.length === 0) {
			new Notice(`No generated pages are recorded for ${file.name}.`);
			return;
		}

		const pageNumbers = [...new Set(
			pagesToRefresh.map(([, provenance]) => provenance.pageNumber),
		)].sort((left, right) => left - right);
		const renderedPages = await this.parsePdf(file, false, pageNumbers);
		if (!renderedPages) return;
		const renderedByPage = new Map(
			renderedPages.map((page) => [page.pageNumber, page]),
		);

		let refreshed = 0;
		let skipped = 0;
		let updatedIndex = this.generatedPages;
		for (const [imagePath, provenance] of pagesToRefresh) {
			const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
			const renderedPage = renderedByPage.get(provenance.pageNumber);
			if (!renderedPage) {
				skipped += 1;
				continue;
			}
			if (imageFile === null) {
				await this.ensureFolder(imagePath.slice(0, imagePath.lastIndexOf("/")));
				await this.app.vault.createBinary(imagePath, renderedPage.buffer);
			} else if (imageFile instanceof TFile && imageFile.extension === "webp") {
				await this.app.vault.modifyBinary(imageFile, renderedPage.buffer);
			} else {
				skipped += 1;
				continue;
			}
			updatedIndex = recordGeneratedPageProvenance(
				updatedIndex,
				imagePath,
				file.path,
				provenance.pageNumber,
				provenance.label,
				file.stat.mtime,
			);
			refreshed += 1;
		}
		if (refreshed > 0) {
			this.generatedPages = updatedIndex;
			await this.saveSettings();
		}
		const movedText = migration.moved > 0
			? ` Moved ${migration.moved} image${migration.moved === 1 ? "" : "s"}.`
			: "";
		const skippedCount = skipped + migration.skipped;
		const skippedText = skippedCount > 0
			? ` Skipped ${skippedCount} image${skippedCount === 1 ? "" : "s"}.`
			: "";
		new Notice(
			`Refreshed ${refreshed} generated image${refreshed === 1 ? "" : "s"} from ${file.name}.${movedText}${skippedText}`,
		);
	}

	private async rebuildGeneratedImageSourceIndex(): Promise<void> {
		const files = this.app.vault.getFiles();
		const { generatedPages, added, missingImages, removed } = rebuildGeneratedPageProvenance(
			this.generatedPages,
			files.filter((file) => file.extension === "webp").map((file) => file.path),
			files.filter((file) => file.extension === "pdf").map((file) => file.path),
			normalizePath(this.settings.imageFolder),
		);
		if (added === 0 && removed === 0 && missingImages === 0) {
			new Notice("The generated-image source index already matches the vault.");
			return;
		}

		this.generatedPages = generatedPages;
		await this.saveSettings();
		const addedText = added > 0
			? ` Added ${added} source record${added === 1 ? "" : "s"}.`
			: "";
		const removedText = removed > 0
			? ` Removed ${removed} stale record${removed === 1 ? "" : "s"}.`
			: "";
		const missingText = missingImages > 0
			? ` ${missingImages} recorded image${missingImages === 1 ? " is" : "s are"} missing. Use refresh to recreate ${missingImages === 1 ? "it" : "them"}.`
			: "";
		new Notice(
			`Rebuilt the generated-image source index.${addedText}${removedText}${missingText}`,
		);
	}

	private async getOrRenderPdfPage(
		file: TFile,
		pageNumber: number,
		label: string | null,
	): Promise<{ outputPath: string; reused: boolean } | null> {
		const expectedOutputPath = getPdfPageOutputPath(
			this.settings.imageFolder,
			file.path,
			pageNumber,
			this.settings.outputPathStrategy,
		);
		let indexedOutputPath: string | null = null;
		const existingImagePaths = new Set<string>();
		for (const imagePath of findGeneratedPagePaths(
			this.generatedPages,
			file.path,
			pageNumber,
		)) {
			const imageFile = this.app.vault.getFileByPath(imagePath);
			if (imageFile?.extension === "webp") {
				indexedOutputPath = imagePath;
				break;
			}
		}
		for (const [imagePath] of Object.entries(this.generatedPages)) {
			if (this.app.vault.getFileByPath(imagePath)?.extension === "webp") {
				existingImagePaths.add(imagePath);
			}
		}
		const existingLayoutOutputPath = findGeneratedPageOutputPathForExistingLayout(
			this.generatedPages,
			existingImagePaths,
			normalizePath(this.settings.imageFolder),
			file.path,
			pageNumber,
		);
		const expectedProvenance = this.generatedPages[expectedOutputPath];
		const expectedFile = this.app.vault.getFileByPath(expectedOutputPath);
		if (
			expectedProvenance &&
			!hasGeneratedPageProvenance(expectedProvenance, file.path, pageNumber) &&
			!expectedFile &&
			!indexedOutputPath &&
			!existingLayoutOutputPath
		) {
			new Notice(`Output path is reserved by a missing generated page: ${expectedOutputPath}`);
			return null;
		}
		const outputPath = indexedOutputPath ?? existingLayoutOutputPath ?? expectedOutputPath;
		if (
			outputPath === expectedOutputPath &&
			expectedProvenance &&
			!hasGeneratedPageProvenance(expectedProvenance, file.path, pageNumber) &&
			expectedFile?.extension === "webp"
		) {
			new Notice(`Output path belongs to another generated page: ${expectedOutputPath}`);
			return null;
		}
		const existingFile = this.app.vault.getFileByPath(outputPath);
		if (existingFile) {
			if (existingFile.extension === "webp") {
				const provenance = this.generatedPages[outputPath];
				if (!hasGeneratedPageProvenance(provenance, file.path, pageNumber)) {
					new Notice(`Output path is occupied by an unindexed image: ${outputPath}`);
					return null;
				}
				if (
					provenance && isGeneratedPageStale(
						provenance,
						file.stat.mtime,
						existingFile.stat.mtime,
					)
				) {
					new Notice(
						"Source PDF changed. Refresh the generated image explicitly before reusing it.",
					);
					return null;
				}
				await this.rememberGeneratedPage(
					outputPath,
					file.path,
					pageNumber,
					label,
					file.stat.mtime,
				);
				return { outputPath, reused: true };
			} else {
				new Notice(`Output path is already occupied: ${outputPath}`);
			}
			return null;
		}

		const pages = await this.parsePdf(file, false, [pageNumber]);
		if (!pages?.[0]) return null;

		const outputFolder = outputPath.slice(0, outputPath.lastIndexOf("/"));
		await this.ensureFolder(outputFolder);
		await this.app.vault.createBinary(outputPath, pages[0].buffer);
		await this.rememberGeneratedPage(
			outputPath,
			file.path,
			pageNumber,
			label,
			file.stat.mtime,
		);
		return { outputPath, reused: false };
	}

	private async rememberGeneratedPage(
		imagePath: string,
		pdfPath: string,
		pageNumber: number,
		label: string | null,
		sourceMtime?: number,
	): Promise<void> {
		this.generatedPages = recordGeneratedPageProvenance(
			this.generatedPages,
			imagePath,
			pdfPath,
			pageNumber,
			label,
			sourceMtime,
		);
		await this.saveSettings();
	}

	private async updateGeneratedPageProvenanceForRename(
		file: TAbstractFile,
		oldPath: string,
	): Promise<void> {
		const previousIndex = this.generatedPages;
		this.generatedPages = updateGeneratedPageProvenanceForRename(
			this.generatedPages,
			oldPath,
			file.path,
		);
		let moved = 0;
		let skipped = 0;
		const renamedPdfs = file instanceof TFile && file.extension === "pdf"
			? [{ file, oldPath }]
			: file instanceof TFolder
				? this.app.vault.getFiles()
					.filter((candidate) =>
						candidate.extension === "pdf" &&
						candidate.path.startsWith(`${file.path}/`),
					)
					.map((candidate) => ({
						file: candidate,
						oldPath: `${oldPath}${candidate.path.slice(file.path.length)}`,
					}))
				: [];
		for (const renamedPdf of renamedPdfs) {
			const result = await this.moveGeneratedPagesForRenamedPdf(
				renamedPdf.file,
				renamedPdf.oldPath,
			);
			moved += result.moved;
			skipped += result.skipped;
		}
		if (this.generatedPages !== previousIndex) await this.saveSettings();
		if (moved > 0 || skipped > 0) {
			const skippedText = skipped > 0
				? ` Skipped ${skipped} image${skipped === 1 ? "" : "s"}.`
				: "";
			new Notice(
				`Moved ${moved} generated image${moved === 1 ? "" : "s"} for ${file.name}.${skippedText}`,
			);
		}
	}

	private async moveGeneratedPagesForRenamedPdf(
		file: TFile,
		oldPdfPath?: string,
	): Promise<{ moved: number; skipped: number }> {
		let moved = 0;
		let skipped = 0;
		const imageFolder = normalizePath(this.settings.imageFolder);
		const generatedPages = Object.entries(this.generatedPages).filter(
			([, provenance]) => provenance.pdfPath === file.path,
		);
		for (const [imagePath, provenance] of generatedPages) {
			const strategy = oldPdfPath
				? getGeneratedPageOutputStrategy(
					imagePath,
					imageFolder,
					oldPdfPath,
					provenance.pageNumber,
				) ?? inferGeneratedPageOutputStrategy(imagePath, imageFolder)
				: inferGeneratedPageOutputStrategy(imagePath, imageFolder);
			if (!strategy) continue;
			const newImagePath = getPdfPageOutputPath(
				imageFolder,
				file.path,
				provenance.pageNumber,
				strategy,
			);
			if (newImagePath === imagePath) continue;
			const imageFile = this.app.vault.getFileByPath(imagePath);
			if (!imageFile || imageFile.extension !== "webp") {
				skipped += 1;
				continue;
			}
			if (
				this.app.vault.getAbstractFileByPath(newImagePath) ||
				this.generatedPages[newImagePath]
			) {
				skipped += 1;
				continue;
			}
			try {
				await this.ensureFolder(newImagePath.slice(0, newImagePath.lastIndexOf("/")));
				await this.app.fileManager.renameFile(imageFile, newImagePath);
				this.generatedPages = updateGeneratedPageProvenanceForRename(
					this.generatedPages,
					imagePath,
					newImagePath,
				);
				moved += 1;
			} catch (error) {
				console.error("pdf-page-embedder: could not move generated image", error);
				skipped += 1;
			}
		}
		if (moved > 0) await this.removeEmptyGeneratedImageFoldersInternal(false);
		return { moved, skipped };
	}

	async removeEmptyGeneratedImageFolders(): Promise<void> {
		await this.removeEmptyGeneratedImageFoldersInternal(true);
	}

	private async removeEmptyGeneratedImageFoldersInternal(
		showNotice: boolean,
	): Promise<void> {
		const rootPath = normalizePath(this.settings.imageFolder);
		const rootFolder = this.app.vault.getAbstractFileByPath(rootPath);
		if (!(rootFolder instanceof TFolder)) {
			if (showNotice) new Notice(`Generated-image folder not found: ${rootPath}`);
			return;
		}

		const toFolderTree = (folder: TFolder): FolderTree => ({
			path: folder.path,
			children: folder.children.map((child) =>
				child instanceof TFolder ? toFolderTree(child) : { path: child.path },
			),
		});
		let removed = 0;
		let skipped = 0;
		for (const path of findEmptyGeneratedFolderPaths(toFolderTree(rootFolder))) {
			const folder = this.app.vault.getAbstractFileByPath(path);
			if (!(folder instanceof TFolder) || folder.children.length > 0) continue;
			try {
				await this.app.vault.delete(folder, true);
				removed += 1;
			} catch (error) {
				console.error("pdf-page-embedder: could not remove empty folder", error);
				skipped += 1;
			}
		}
		if (showNotice) {
			const skippedText = skipped > 0
				? ` Skipped ${skipped} folder${skipped === 1 ? "" : "s"}.`
				: "";
			new Notice(
				removed === 0
					? skipped === 0
						? "No empty generated-image folders were found."
						: `Could not remove empty generated-image folders.${skippedText}`
					: `Removed ${removed} empty generated-image folder${removed === 1 ? "" : "s"}.${skippedText}`,
			);
		}
	}

	private resolvePdfPageEmbedAtCursor(
		editor: Editor,
	): { file: TFile; pageEmbed: PdfPageEmbed } | null {
		const cursor = editor.getCursor();
		const parsedEmbed = findPdfPageEmbedAtCursor(
			editor.getLine(cursor.line),
			cursor.ch,
		);
		if (!parsedEmbed) {
			new Notice("Place the cursor inside ![[file.pdf#page=N]].");
			return null;
		}

		const pageEmbed = resolvePdfPageEmbed(
			parsedEmbed,
			this.activeNotePath(),
			this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache),
		);
		const file = pageEmbed
			? this.app.vault.getFileByPath(pageEmbed.pdfPath)
			: null;
		if (!pageEmbed || !file || file.extension !== "pdf") {
			new Notice(`PDF not found: ${parsedEmbed.pdfPath}`);
			return null;
		}

		return { file, pageEmbed };
	}

	private resolveGeneratedPageEmbedAtCursor(editor: Editor) {
		const cursor = editor.getCursor();
		return resolveGeneratedPageEmbedAtCursor(
			editor.getLine(cursor.line),
			cursor.ch,
			this.activeNotePath(),
			this.app.metadataCache.getFirstLinkpathDest.bind(this.app.metadataCache),
		);
	}

	private activeNotePath(): string {
		return this.app.workspace.getActiveViewOfType(MarkdownView)?.file?.path
			?? this.app.workspace.getActiveFile()?.path
			?? "";
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const parts = normalizePath(folderPath).split("/");
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const existingFile = this.app.vault.getAbstractFileByPath(currentPath);
			if (!existingFile) {
				await this.app.vault.createFolder(currentPath);
			} else if (!(existingFile instanceof TFolder)) {
				throw new Error(`Cannot create output folder at ${currentPath}.`);
			}
		}
	}

	private async printPdf(file: TFile, promptForRange = false): Promise<string | null> {
		const pages = await this.parsePdf(file, promptForRange);
		if (pages === null) return null;
		if (pages.length === 0) {
			new Notice("No images could be generated from the document.");
			return null;
		}
		const imagePaths = await this.convertPdfBufferToImages({
			fileName: file.basename,
			pages,
		});
		return formatPrintedPages(file.path, imagePaths, this.settings);
	}

	async loadSettings() {
		const savedData = await this.loadData() as LegacyPluginData | null;
		const {
			generatedPages = {},
			preservePdfLink: legacyPreservePdfLink,
			...savedSettings
		} = savedData ?? {};
		const { settings, repaired } = repairPdfPrinterSettings(
			savedSettings,
			DEFAULT_SETTINGS,
			normalizePath,
		);
		this.settings = settings;
		this.generatedPages = generatedPages;
		if (legacyPreservePdfLink !== undefined || repaired) await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			generatedPages: this.generatedPages,
		});
	}

	/**
	 * Checks if the input string adheres to the format ![[something]].
	 * @param input the string to parse
	 * @description checks if the input is a valid file path
	 * @returns found file path (something) or null
	 */
	private checkPathInput(input: string): string | null {
		const matches = input.match(/!\[\[(.+?)\]\]/); // match ![[something]], -> something (capture group 1)
		if (matches && matches[1]) {
			return matches[1];
		}
		return null;
	}

	/**
	 * attempts to parse a string as a file path
	 * @param input the string to parse
	 * @returns the file if it is a valid file path, null otherwise
	 */
	private fetchFileFromMdPath(input: string): TFile | null {
		const path = input.trim();
		if (!path) {
			new Notice("Please select a valid PDF file link.");
			return null;
		}
		const filePath = this.checkPathInput(path);
		if (!filePath) {
			new Notice(
				`Invalid file path: ${path}. Please highlight a valid PDF file ![[link.pdf]].`,
			);
			return null;
		}
		const [rawTarget] = filePath.split("|", 1);
		const file = this.app.metadataCache.getFirstLinkpathDest(
			rawTarget.trim(),
			this.activeNotePath(),
		);
		if (!file) {
			new Notice(`File not found: ${filePath}.`);
			return null;
		}
		if (file.extension !== "pdf") {
			new Notice(`File is not a PDF: ${filePath}.`);
			return null;
		}
		return file;
	}

	/**
	 * Parses a given TFile object (PDF) and converts it to PNG images.
	 * The images are saved in the vault and their paths are returned as an array of strings.
	 * @param file The TFile object representing the PDF file to be parsed.
	 * @description The function uses the pdfjs library to convert the PDF to images.
	 * @throws Error if the canvas or context cannot be created.
	 * @returns An array of strings representing the paths of the saved PNG images.
	 */
	async parsePdf(
		file: TFile,
		promptForRange = false,
		requestedPages?: number[],
	): Promise<PdfPage[] | null> {
		const pdfjs = await loadPdfJs();
		const arrayBuffer = await this.app.vault.readBinary(file);
		const buffer = new Uint8Array(arrayBuffer);
		const document = await pdfjs.getDocument(buffer).promise;

		const pages: number = document.numPages;
		const selectedPages = requestedPages ?? (promptForRange
			? await promptForPageRange(this.app, pages)
			: undefined);
		if (selectedPages === null) {
			await document.destroy();
			return null;
		}
		if (selectedPages && !hasValidPdfPageNumbers(selectedPages, pages)) {
			await document.destroy();
			new Notice(`Enter pages between 1 and ${pages}.`);
			return null;
		}
		new Notice(`Printing document '${file.name}'...`);
		const pageNumbers = selectedPages ?? Array.from(
			{ length: pages },
			(_, index) => index + 1,
		);
		return renderPdfPages(
			document,
			pageNumbers,
			this.settings.imageQuality,
			() => new BrowserCanvasFactory(),
		);
	}

	/**
	 * Converts a PDF page buffer to a PNG file and saves it in the vault.
	 * @param page The PDF page buffer to convert.
	 * @param pageNumber The page number of the PDF.
	 * @returns The path of the saved PNG file.
	 */
	private async convertPdfBufferToImages(
		pdfBuffer: PdfDocumentBuffer,
	): Promise<string[]> {
		let uuid = uuidv4();
		while (
			this.app.vault.getFileByPath(
				`${this.settings.imageFolder}/${uuid}`,
			) !== null
		) {
			uuid = uuidv4(); // if folder already exists (???), generate a new uuid
		}
		await this.app.vault.createFolder(
			`${this.settings.imageFolder}/${uuid}`,
		);
		const writeTasks = pdfBuffer.pages.map(async (page) => {
			const fileName = `${pdfBuffer.fileName}-${page.pageNumber}.webp`;
			const fullPath = `${this.settings.imageFolder}/${uuid}/${fileName}`;
			await this.app.vault.createBinary(fullPath, page.buffer);
			return fileName;
		});
		return Promise.all(writeTasks);
	}
}
