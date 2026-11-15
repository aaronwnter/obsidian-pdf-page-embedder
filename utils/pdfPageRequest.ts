export function hasValidPdfPageNumbers(
	pageNumbers: number[],
	pageCount: number,
): boolean {
	return pageNumbers.length > 0 && pageNumbers.every((pageNumber) =>
		Number.isSafeInteger(pageNumber) &&
		pageNumber >= 1 &&
		pageNumber <= pageCount,
	);
}
