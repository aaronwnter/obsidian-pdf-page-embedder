export type FolderTree = {
	path: string;
	children: Array<FolderTree | { path: string }>;
};

/**
 * Lists empty descendants deepest first, so callers can remove children before
 * their newly empty parents. The root itself is never included.
 */
export function findEmptyGeneratedFolderPaths(root: FolderTree): string[] {
	const emptyFolders: string[] = [];

	function visit(folder: FolderTree, isRoot = false): boolean {
		let containsFiles = false;
		for (const child of folder.children) {
			if (!("children" in child)) {
				containsFiles = true;
				continue;
			}
			if (visit(child)) containsFiles = true;
		}
		if (!isRoot && !containsFiles) emptyFolders.push(folder.path);
		return containsFiles;
	}

	visit(root, true);
	return emptyFolders;
}
