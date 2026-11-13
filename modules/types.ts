export type OutputPathStrategy =
	| "shallow-source-id"
	| "detailed-shallow-source-id"
	| "mirror-source-path";

export type SourceLinkPlacement = "none" | "above" | "below";

export interface PdfPrinterSettings {
	imageFolder: string;
	outputPathStrategy: OutputPathStrategy;
	imageQuality: number;
	imageEmbedFormat: string;
	sourceLinkPlacement: SourceLinkPlacement;
	newlineBetweenPages: boolean;
}

export type PdfDocumentBuffer = {
	fileName: string;
	pages: PdfPage[];
};

export type PdfPage = {
	pageNumber: number;
	buffer: ArrayBuffer;
};
