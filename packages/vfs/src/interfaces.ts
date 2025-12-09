/**
 * File statistics interface that mirrors Node.js fs.Stats but with only essential properties
 */
export interface FileStat {
	isFile(): boolean;
	isDirectory(): boolean;
	size: number;
	mtime: Date;
}

/**
 * Abstract file system interface for dependency injection and testing.
 * Provides both synchronous and asynchronous variants of all operations.
 */
export interface IFileSystem {
	// Existence checks
	exists(path: string): boolean;
	existsAsync(path: string): Promise<boolean>;

	// Directory operations
	mkdir(path: string, options?: { recursive?: boolean }): void;
	mkdirAsync(path: string, options?: { recursive?: boolean }): Promise<void>;
	readDir(path: string): string[];
	readDirAsync(path: string): Promise<string[]>;
	rmdir(path: string, options?: { recursive?: boolean }): void;
	rmdirAsync(path: string, options?: { recursive?: boolean }): Promise<void>;

	// File operations
	writeFile(path: string, content: string | Buffer): void;
	writeFileAsync(path: string, content: string | Buffer): Promise<void>;
	readFile(path: string): string;
	readFileAsync(path: string): Promise<string>;
	unlink(path: string): void;
	unlinkAsync(path: string): Promise<void>;

	// Metadata
	stat(path: string): FileStat;
	statAsync(path: string): Promise<FileStat>;
}
