import * as fs from "node:fs/promises";
import * as path from "node:path";

export class WasmLoader {
  private cachePath: string;
  private memoryCache: Map<string, WebAssembly.Module> = new Map();

  constructor(cachePath: string = "./cache/wasm") {
    this.cachePath = cachePath;
  }

  async load(runtimeName: string): Promise<WebAssembly.Module> {
    // Check Memory Cache
    const cached = this.memoryCache.get(runtimeName);
    if (cached) {
      return cached;
    }

    // Check Disk Cache
    const filePath = path.join(this.cachePath, `${runtimeName}.wasm`);
    try {
      const buffer = await fs.readFile(filePath);
      const module = await WebAssembly.compile(buffer);
      this.memoryCache.set(runtimeName, module);
      return module;
    } catch (_e) {
      // Fetch from Registry (TODO: Implement remote fetch)
      // For now, throw
      throw new Error(`Runtime ${runtimeName} not found in ${filePath}`);
    }
  }
}
