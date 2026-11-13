import { BrowserCanvasFactory } from "utils/canvas/canvasFactory";
import { formatPrintedPages } from "utils/formatPrintedPages";
import { findPdfPageEmbedAtCursor, PdfPageEmbed } from "utils/pdfPageEmbed";
import { getPdfPageOutputPath } from "utils/pdfPageOutput";
import { Editor, normalizePath, Notice, Plugin, TFile, TFolder, loadPdfJs } from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_SETTINGS, PdfPrinterSettingsTab } from "modules/settings";
import { registerPdfPreview } from "modules/pdfPreview";
import { promptForPageRange } from "modules/pageRangeModal";
import { PdfDocumentBuffer, PdfPage, PdfPrinterSettings } from "modules/types";

export default class PdfPrinterPlugin extends Plugin {
	settings!: PdfPrinterSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "convert-pdf-to-images",
			name: "Convert PDF to images",
			editorCallback: (editor: Editor) => this.printSelection(editor),
		});
		this.addCommand({
			id: "convert-pdf-page-ranges-to-images",
			name: "Convert PDF page ranges to images",
			editorCallback: (editor: Editor) => this.printSelection(editor, true),
		});
		this.addCommand({
			id: "inspect-pdf-page-embed-at-cursor",
			name: "Inspect PDF page embed at cursor (development)",
			editorCallback: (editor: Editor) => this.inspectPdfPageEmbedAtCursor(editor),
		});
		this.addCommand({
			id: "render-pdf-page-embed-at-cursor",
			name: "Render PDF page embed at cursor (development)",
			editorCallback: (editor: Editor) => this.renderPdfPageEmbedAtCursor(editor),
		});
		this.addSettingTab(new PdfPrinterSettingsTab(this.app, this));
		registerPdfPreview(this, (file, promptForRange) => this.printPdf(file, promptForRange));
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
		const outputPath = getPdfPageOutputPath(
			this.settings.imageFolder,
			file.path,
			pageEmbed.pageNumber,
			this.settings.outputPathStrategy,
		);
		const existingFile = this.app.vault.getFileByPath(outputPath);
		if (existingFile) {
			if (existingFile.extension === "webp") {
				new Notice(`Reusing ${outputPath}.`);
			} else {
				new Notice(`Output path is already occupied: ${outputPath}`);
			}
			return;
		}

		const pages = await this.parsePdf(file, false, [pageEmbed.pageNumber]);
		if (!pages?.[0]) return;

		const outputFolder = outputPath.slice(0, outputPath.lastIndexOf("/"));
		await this.ensureFolder(outputFolder);
		await this.app.vault.createBinary(outputPath, pages[0].buffer);
		new Notice(`Rendered page ${pageEmbed.pageNumber} to ${outputPath}.`);
	}

	private resolvePdfPageEmbedAtCursor(
		editor: Editor,
	): { file: TFile; pageEmbed: PdfPageEmbed } | null {
		const cursor = editor.getCursor();
		const pageEmbed = findPdfPageEmbedAtCursor(
			editor.getLine(cursor.line),
			cursor.ch,
		);
		if (!pageEmbed) {
			new Notice("Place the cursor inside ![[file.pdf#page=N]].");
			return null;
		}

		const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
		const file = this.app.metadataCache.getFirstLinkpathDest(
			pageEmbed.pdfPath,
			sourcePath,
		);
		if (!file || file.extension !== "pdf") {
			new Notice(`PDF not found: ${pageEmbed.pdfPath}`);
			return null;
		}

		return { file, pageEmbed };
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, "");
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
		if (selectedPages?.some((page) => page > pages)) {
			await document.destroy();
			new Notice(`Document '${file.name}' does not contain that page.`);
			return null;
		}
		new Notice(`Printing document '${file.name}'...`);
		const pdfBuffer: PdfPage[] = [];

		for (let i = 1; i <= pages; i++) {
			if (selectedPages && !selectedPages.includes(i)) continue;
			const page = await document.getPage(i);
			const viewport = page.getViewport({ scale: 2 });
			const canvasFactory = new BrowserCanvasFactory();
			const { canvas, context } = canvasFactory.create(
				viewport.width,
				viewport.height,
				false,
			);
			if (!canvas || !context) {
				console.error(
				"pdf-page-embedder: could not generate canvas or context",
				);
				return [];
			}
			await page.render({ canvasContext: context, viewport }).promise;
			const blob = await new Promise<Blob | null>((resolve) => {
				/** @ts-ignore because toBlob exists, but is not found */
				canvas.toBlob(
					resolve,
					"image/webp",
					this.settings.imageQuality,
				);
			});

			if (blob) {
				pdfBuffer.push({
					pageNumber: i,
					buffer: await blob.arrayBuffer(),
				});
			} else {
				console.error(
				`pdf-page-embedder: could not generate blob for page ${i}`,
				);
			}
			canvasFactory.destroy({ canvas, context });
		}

		return pdfBuffer;
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
