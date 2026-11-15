export type OutputPathStrategy =
	| "shallow-source-id"
	| "detailed-shallow-source-id"
	| "mirror-source-path";

export type SourceLinkPlacement = "none" | "above" | "below";

export type GeneratedPageProvenance = {
	pdfPath: string;
	pageNumber: number;
	label: string | null;
	sourceMtime?: number;
};

export type GeneratedPageIndex = Record<string, GeneratedPageProvenance>;

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
