import type { PdfPage } from "modules/types";

type Viewport = { width: number; height: number };

type RenderablePdfPage = {
	getViewport(options: { scale: number }): Viewport;
	render(options: {
		canvasContext: CanvasRenderingContext2D;
		viewport: Viewport;
	}): { promise: Promise<void> };
	cleanup?: () => void;
};

export type RenderablePdfDocument = {
	getPage(pageNumber: number): Promise<RenderablePdfPage>;
	destroy(): Promise<void> | void;
};

type CanvasAndContext = {
	canvas: HTMLCanvasElement | null;
	context: CanvasRenderingContext2D | null;
};

export type PdfCanvasFactory = {
	create(width: number, height: number, transparent: boolean): CanvasAndContext;
	destroy(canvasAndContext: CanvasAndContext): void;
};

/** Renders requested PDF pages and always releases PDF and canvas resources. */
export async function renderPdfPages(
	document: RenderablePdfDocument,
	pageNumbers: number[],
	imageQuality: number,
	createCanvasFactory: () => PdfCanvasFactory,
): Promise<PdfPage[]> {
	try {
		const renderedPages: PdfPage[] = [];
		for (const pageNumber of pageNumbers) {
			const page = await document.getPage(pageNumber);
			let canvasFactory: PdfCanvasFactory | null = null;
			let canvasAndContext: CanvasAndContext | null = null;
			try {
				const viewport = page.getViewport({ scale: 2 });
				canvasFactory = createCanvasFactory();
				canvasAndContext = canvasFactory.create(
					viewport.width,
					viewport.height,
					false,
				);
				const { canvas, context } = canvasAndContext;
				if (!canvas || !context) {
					throw new Error("Could not create a canvas for the PDF page.");
				}
				await page.render({
					canvasContext: context,
					viewport,
				}).promise;
				const blob = await new Promise<Blob | null>((resolve) => {
					canvas.toBlob(resolve, "image/webp", imageQuality);
				});
				if (!blob) throw new Error(`Could not encode PDF page ${pageNumber} as WebP.`);
				renderedPages.push({
					pageNumber,
					buffer: await blob.arrayBuffer(),
				});
			} finally {
				page.cleanup?.();
				if (canvasFactory && canvasAndContext) {
					canvasFactory.destroy(canvasAndContext);
				}
			}
		}
		return renderedPages;
	} finally {
		await document.destroy();
	}
}
