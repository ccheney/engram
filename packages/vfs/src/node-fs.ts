import * as fs from "node:fs";
import type { FileStat, IFileSystem } from "./interfaces";

/**
 * Node.js file system implementation of IFileSystem.
 * Wraps the native fs module for production use.
 */
export class NodeFileSystem implements IFileSystem {
	exists(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	async existsAsync(filePath: string): Promise<boolean> {
		try {
			await fs.promises.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	mkdir(dirPath: string, options?: { recursive?: boolean }): void {
		fs.mkdirSync(dirPath, options);
	}

	async mkdirAsync(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
		await fs.promises.mkdir(dirPath, options);
	}

	readDir(dirPath: string): string[] {
		return fs.readdirSync(dirPath);
	}

	async readDirAsync(dirPath: string): Promise<string[]> {
		return fs.promises.readdir(dirPath);
	}

	rmdir(dirPath: string, options?: { recursive?: boolean }): void {
		if (options?.recursive) {
			fs.rmSync(dirPath, { recursive: true, force: true });
		} else {
			fs.rmdirSync(dirPath);
		}
	}

	async rmdirAsync(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
		if (options?.recursive) {
			await fs.promises.rm(dirPath, { recursive: true, force: true });
		} else {
			await fs.promises.rmdir(dirPath);
		}
	}

	writeFile(filePath: string, content: string | Buffer): void {
		fs.writeFileSync(filePath, content);
	}

	async writeFileAsync(filePath: string, content: string | Buffer): Promise<void> {
		await fs.promises.writeFile(filePath, content);
	}

	readFile(filePath: string): string {
		return fs.readFileSync(filePath, "utf-8");
	}

	async readFileAsync(filePath: string): Promise<string> {
		return fs.promises.readFile(filePath, "utf-8");
	}

	unlink(filePath: string): void {
		fs.unlinkSync(filePath);
	}

	async unlinkAsync(filePath: string): Promise<void> {
		await fs.promises.unlink(filePath);
	}

	stat(filePath: string): FileStat {
		const stats = fs.statSync(filePath);
		return {
			isFile: () => stats.isFile(),
			isDirectory: () => stats.isDirectory(),
			size: stats.size,
			mtime: stats.mtime,
		};
	}

	async statAsync(filePath: string): Promise<FileStat> {
		const stats = await fs.promises.stat(filePath);
		return {
			isFile: () => stats.isFile(),
			isDirectory: () => stats.isDirectory(),
			size: stats.size,
			mtime: stats.mtime,
		};
	}
}
