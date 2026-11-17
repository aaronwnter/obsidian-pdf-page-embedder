import { flatten, parse } from "multi-integer-range";

export function parsePageRange(input: string, pageCount: number): number[] {
	const ranges = parse(input);
	if (
		/\d\s+\d/.test(input) ||
		!ranges.length ||
		ranges.some(([start, end]) => start < 1 || end > pageCount)
	) {
		throw new Error("Invalid page range");
	}
	return flatten(ranges);
}

export type PdfPageSelection = {
	pageNumbers: number[];
	isFullDocument: boolean;
};

export function parsePdfPageSelection(
	input: string,
	pageCount: number,
): PdfPageSelection {
	const trimmedInput = input.trim();
	if (!trimmedInput || trimmedInput.toLowerCase() === "full") {
		return {
			pageNumbers: Array.from({ length: pageCount }, (_, index) => index + 1),
			isFullDocument: true,
		};
	}
	return { pageNumbers: parsePageRange(trimmedInput, pageCount), isFullDocument: false };
}
