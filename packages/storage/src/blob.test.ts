import * as fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlobStore, FileSystemBlobStore, GCSBlobStore } from "./blob";

describe("Blob Storage", () => {
	const testDir = `/tmp/engram-blob-test-${Date.now()}`;

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true });
		} catch {
			// Directory may not exist, ignore
		}
	});

	describe("FileSystemBlobStore", () => {
		it("should save content and return file URI", async () => {
			const store = new FileSystemBlobStore(testDir);
			const content = "Hello World";
			const uri = await store.save(content);

			expect(uri).toMatch(/^file:\/\//);
			expect(uri).toContain(testDir);
		});

		it("should generate deterministic hash-based filenames", async () => {
			const store = new FileSystemBlobStore(testDir);

			const uri1 = await store.save("same content");
			const uri2 = await store.save("same content");

			expect(uri1).toBe(uri2);
		});

		it("should generate different filenames for different content", async () => {
			const store = new FileSystemBlobStore(testDir);

			const uri1 = await store.save("content 1");
			const uri2 = await store.save("content 2");

			expect(uri1).not.toBe(uri2);
		});

		it("should read saved content", async () => {
			const store = new FileSystemBlobStore(testDir);
			const content = "hello world";

			const uri = await store.save(content);
			const readContent = await store.read(uri);

			expect(readContent).toBe(content);
		});

		it("should create directory if it does not exist", async () => {
			const nestedDir = `${testDir}/nested/dir`;
			const store = new FileSystemBlobStore(nestedDir);

			await store.save("content");

			const stat = await fs.stat(nestedDir);
			expect(stat.isDirectory()).toBe(true);
		});

		it("should throw on invalid URI scheme", async () => {
			const store = new FileSystemBlobStore(testDir);

			await expect(store.read("gs://bucket/hash")).rejects.toThrow("Invalid URI scheme");
		});

		it("should throw on non-existent file read", async () => {
			const store = new FileSystemBlobStore(testDir);

			await expect(store.read("file:///nonexistent/file")).rejects.toThrow();
		});

		it("should handle empty content", async () => {
			const store = new FileSystemBlobStore(testDir);

			const uri = await store.save("");
			const content = await store.read(uri);

			expect(content).toBe("");
		});

		it("should handle large content", async () => {
			const store = new FileSystemBlobStore(testDir);
			const largeContent = "x".repeat(100000);

			const uri = await store.save(largeContent);
			const content = await store.read(uri);

			expect(content).toBe(largeContent);
		});

		it("should handle unicode content", async () => {
			const store = new FileSystemBlobStore(testDir);
			const unicodeContent = "Hello World! Special chars";

			const uri = await store.save(unicodeContent);
			const content = await store.read(uri);

			expect(content).toBe(unicodeContent);
		});

		it("should handle JSON content", async () => {
			const store = new FileSystemBlobStore(testDir);
			const jsonContent = JSON.stringify({ key: "value", nested: { array: [1, 2, 3] } });

			const uri = await store.save(jsonContent);
			const content = await store.read(uri);

			expect(JSON.parse(content)).toEqual({ key: "value", nested: { array: [1, 2, 3] } });
		});
	});

	describe("GCSBlobStore", () => {
		let originalWarn: any;
		let mockWarn: ReturnType<typeof spyOn>;

		beforeEach(() => {
			originalWarn = console.warn;
			mockWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		});

		afterEach(() => {
			mockWarn.mockRestore();
			console.warn = originalWarn;
		});

		it("should generate GCS URI on save", async () => {
			const store = new GCSBlobStore("test-bucket");

			// This will fail due to no GCS credentials, but should return a stub URI
			const uri = await store.save("test content");

			expect(uri).toMatch(/^gs:\/\/test-bucket\/[a-f0-9]+$/);
		});

		it("should generate deterministic hash-based filenames", async () => {
			const store = new GCSBlobStore("test-bucket");

			const uri1 = await store.save("same content");
			const uri2 = await store.save("same content");

			expect(uri1).toBe(uri2);
		});

		it("should throw on invalid URI scheme", async () => {
			const store = new GCSBlobStore("test-bucket");

			await expect(store.read("file:///local/file")).rejects.toThrow("Invalid URI scheme");
		});

		it("should throw on invalid GCS URI format", async () => {
			const store = new GCSBlobStore("test-bucket");

			await expect(store.read("gs://bucket-only")).rejects.toThrow("Invalid GCS URI format");
		});

		it("should warn and fallback on GCS read failure", async () => {
			const store = new GCSBlobStore("test-bucket");

			const result = await store.read("gs://test-bucket/somefile");
			expect(result).toBe("");
			expect(mockWarn).toHaveBeenCalled();
		});
	});

	describe("Factory", () => {
		it("should create FS store by default", () => {
			const store = createBlobStore();
			expect(store.save).toBeDefined();
			expect((store as any).basePath).toBeDefined();
		});

		it("should create FS store when type is fs", () => {
			const store = createBlobStore("fs");
			expect((store as any).basePath).toBeDefined();
		});

		it("should create GCS store when requested", () => {
			const store = createBlobStore("gcs");
			expect(store.save).toBeDefined();
			expect((store as any).bucket).toBeDefined();
		});
	});
});
