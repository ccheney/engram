import { describe, expect, it } from "vitest";
import { PatchManager } from "./patch";
import { VirtualFileSystem } from "./vfs";

describe("PatchManager", () => {
	describe("applySearchReplace", () => {
		it("should apply search and replace", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "const x = 1;");
			const pm = new PatchManager(vfs);

			pm.applySearchReplace("/code.ts", "const x = 1;", "const x = 2;");
			expect(vfs.readFile("/code.ts")).toBe("const x = 2;");
		});

		it("should replace first occurrence only", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "const x = 1;\nconst x = 1;");
			const pm = new PatchManager(vfs);

			pm.applySearchReplace("/code.ts", "const x = 1;", "const x = 2;");
			expect(vfs.readFile("/code.ts")).toBe("const x = 2;\nconst x = 1;");
		});

		it("should handle multiline search and replace", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "function foo() {\n  return 1;\n}");
			const pm = new PatchManager(vfs);

			pm.applySearchReplace(
				"/code.ts",
				"function foo() {\n  return 1;\n}",
				"function foo() {\n  return 2;\n}",
			);
			expect(vfs.readFile("/code.ts")).toBe("function foo() {\n  return 2;\n}");
		});

		it("should throw if search block not found", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "const x = 1;");
			const pm = new PatchManager(vfs);

			expect(() => pm.applySearchReplace("/code.ts", "const y = 1;", "const y = 2;")).toThrow(
				"Search block not found",
			);
		});

		it("should handle empty replacement", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "const x = 1;");
			const pm = new PatchManager(vfs);

			pm.applySearchReplace("/code.ts", "const x = 1;", "");
			expect(vfs.readFile("/code.ts")).toBe("");
		});

		it("should handle special regex characters in search", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/code.ts", "const regex = /[a-z]+/;");
			const pm = new PatchManager(vfs);

			pm.applySearchReplace("/code.ts", "const regex = /[a-z]+/;", "const regex = /[A-Z]+/;");
			expect(vfs.readFile("/code.ts")).toBe("const regex = /[A-Z]+/;");
		});
	});

	describe("applyUnifiedDiff", () => {
		it("should apply unified diff", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/file.txt", "line1\nline2\nline3");
			const pm = new PatchManager(vfs);

			const patch = `--- file.txt
+++ file.txt
@@ -1,3 +1,3 @@
 line1
-line2
+modified
 line3`;

			pm.applyUnifiedDiff("/file.txt", patch);
			expect(vfs.readFile("/file.txt")).toBe("line1\nmodified\nline3");
		});

		it("should apply unified diff to create new file", () => {
			const vfs = new VirtualFileSystem();
			const pm = new PatchManager(vfs);

			const patch = `--- /dev/null
+++ new.txt
@@ -0,0 +1,1 @@
+content`;

			pm.applyUnifiedDiff("/new.txt", patch);
			expect(vfs.readFile("/new.txt").trim()).toBe("content");
		});

		it("should add lines with diff", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/file.txt", "line1\nline2");
			const pm = new PatchManager(vfs);

			const patch = `--- file.txt
+++ file.txt
@@ -1,2 +1,3 @@
 line1
 line2
+line3`;

			pm.applyUnifiedDiff("/file.txt", patch);
			expect(vfs.readFile("/file.txt")).toBe("line1\nline2\nline3");
		});

		it("should remove lines with diff", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/file.txt", "line1\nline2\nline3");
			const pm = new PatchManager(vfs);

			const patch = `--- file.txt
+++ file.txt
@@ -1,3 +1,2 @@
 line1
-line2
 line3`;

			pm.applyUnifiedDiff("/file.txt", patch);
			expect(vfs.readFile("/file.txt")).toBe("line1\nline3");
		});

		it("should throw on failed patch application", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/file.txt", "completely different content");
			const pm = new PatchManager(vfs);

			const patch = `--- file.txt
+++ file.txt
@@ -1,3 +1,3 @@
 line1
-line2
+modified
 line3`;

			expect(() => pm.applyUnifiedDiff("/file.txt", patch)).toThrow("Failed to apply patch");
		});

		it("should handle multiple hunks", () => {
			const vfs = new VirtualFileSystem();
			vfs.writeFile("/file.txt", "a\nb\nc\nd\ne\nf\ng\nh");
			const pm = new PatchManager(vfs);

			const patch = `--- file.txt
+++ file.txt
@@ -1,4 +1,4 @@
 a
-b
+B
 c
 d
@@ -5,4 +5,4 @@
 e
-f
+F
 g
 h`;

			pm.applyUnifiedDiff("/file.txt", patch);
			expect(vfs.readFile("/file.txt")).toBe("a\nB\nc\nd\ne\nF\ng\nh");
		});
	});
});
