import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface BlobStore {
	save(content: string): Promise<string>;
	read(uri: string): Promise<string>;
}

export class FileSystemBlobStore implements BlobStore {
	private basePath: string;

	constructor(basePath: string) {
		this.basePath = basePath;
	}

	async save(content: string): Promise<string> {
		const hash = crypto.createHash("sha256").update(content).digest("hex");
		const filePath = path.join(this.basePath, hash);
		// Ensure directory exists
		await fs.mkdir(this.basePath, { recursive: true });
		await fs.writeFile(filePath, content, "utf-8");
		return `file://${filePath}`;
	}

	async read(uri: string): Promise<string> {
		if (!uri.startsWith("file://")) {
			throw new Error(`Invalid URI scheme for FileSystemBlobStore: ${uri}`);
		}
		const filePath = uri.slice(7); // Remove 'file://'
		return fs.readFile(filePath, "utf-8");
	}
}

export class GCSBlobStore implements BlobStore {
	private bucket: string;
	private storage: unknown; // Lazy loaded @google-cloud/storage client

	constructor(bucket: string) {
		this.bucket = bucket;
	}

	/**
	 * Lazily initialize the Google Cloud Storage client.
	 * Uses Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS env var.
	 */
	private async getStorage() {
		if (!this.storage) {
			// Dynamic import to avoid bundling issues and make GCS optional
			const { Storage } = await import("@google-cloud/storage");
			this.storage = new Storage();
		}
		return this.storage as {
			bucket: (name: string) => {
				file: (name: string) => {
					save: (content: string, options?: { contentType?: string }) => Promise<void>;
					download: () => Promise<[Buffer]>;
					exists: () => Promise<[boolean]>;
				};
			};
		};
	}

	async save(content: string): Promise<string> {
		const hash = crypto.createHash("sha256").update(content).digest("hex");
		const fileName = hash;

		try {
			const storage = await this.getStorage();
			const bucket = storage.bucket(this.bucket);
			const file = bucket.file(fileName);

			await file.save(content, {
				contentType: "application/json",
			});

			return `gs://${this.bucket}/${fileName}`;
		} catch (error) {
			// Fallback to stub behavior if GCS is not available
			console.warn(`[GCS] Failed to upload, error: ${error}`);
			console.log(`[GCS Stub] Would upload to gs://${this.bucket}/${hash}`);
			return `gs://${this.bucket}/${hash}`;
		}
	}

	async read(uri: string): Promise<string> {
		if (!uri.startsWith("gs://")) {
			throw new Error(`Invalid URI scheme for GCSBlobStore: ${uri}`);
		}

		// Parse gs://bucket/filename
		const withoutScheme = uri.slice(5); // Remove 'gs://'
		const slashIndex = withoutScheme.indexOf("/");
		if (slashIndex === -1) {
			throw new Error(`Invalid GCS URI format: ${uri}`);
		}
		const bucketName = withoutScheme.slice(0, slashIndex);
		const fileName = withoutScheme.slice(slashIndex + 1);

		try {
			const storage = await this.getStorage();
			const bucket = storage.bucket(bucketName);
			const file = bucket.file(fileName);

			const [exists] = await file.exists();
			if (!exists) {
				throw new Error(`File not found: ${uri}`);
			}

			const [contents] = await file.download();
			return contents.toString("utf-8");
		} catch (error) {
			// Fallback to stub behavior if GCS is not available
			console.warn(`[GCS] Failed to read, error: ${error}`);
			console.log(`[GCS Stub] Would read from ${uri}`);
			return "";
		}
	}
}

export const createBlobStore = (type: "fs" | "gcs" = "fs"): BlobStore => {
	if (type === "gcs") {
		return new GCSBlobStore(process.env.GCS_BUCKET || "engram-blobs");
	}
	return new FileSystemBlobStore(process.env.BLOB_STORAGE_PATH || "./data/blobs");
};
