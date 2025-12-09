import { applyPatch } from "diff";
import type { VirtualFileSystem } from "./vfs";

export class PatchManager {
	constructor(private vfs: VirtualFileSystem) {}

	public applyUnifiedDiff(filePath: string, diffContent: string) {
		// 1. Read original content
		let originalContent = "";
		try {
			originalContent = this.vfs.readFile(filePath);
		} catch (e) {
			// File not existing is expected for creation patches
			// Check if this is a "file not found" error vs an unexpected error
			const isNotFoundError =
				e instanceof Error &&
				(e.message.includes("not found") ||
					e.message.includes("ENOENT") ||
					e.message.includes("does not exist"));
			if (!isNotFoundError) {
				// Rethrow unexpected errors (permissions, corruption, etc.)
				throw e;
			}
			// File doesn't exist - this is a creation patch, continue with empty content
		}

		// 2. Parse Diff (assuming 'diffContent' is the full unified diff string)
		// Note: 'diff' library expects the patch string.
		// If diffContent is just the hunk, we might need to wrap it or use applyPatch directly?
		// applyPatch(oldStr, patchStr)

		// Check if strict application works
		const result = applyPatch(originalContent, diffContent);

		if (result === false) {
			throw new Error(`Failed to apply patch to ${filePath}`);
		}

		// 3. Write back
		this.vfs.writeFile(filePath, result);
	}

	// Search/Replace Block Logic (Simpler)
	public applySearchReplace(filePath: string, search: string, replace: string) {
		const content = this.vfs.readFile(filePath);
		if (!content.includes(search)) {
			throw new Error(`Search block not found in ${filePath}`);
		}
		const newContent = content.replace(search, replace);
		this.vfs.writeFile(filePath, newContent);
	}
}
