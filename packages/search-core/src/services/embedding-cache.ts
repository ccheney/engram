import { createLogger } from "@engram/logger";
import { RERANK_CONFIG } from "../config";
import {
	computeHitRate,
	embeddingCacheCount,
	embeddingCacheHitRate,
	embeddingCacheSize,
	recordEmbeddingCacheEviction,
	recordEmbeddingCacheHit,
	recordEmbeddingCacheMiss,
} from "./cache-metrics";

export interface EmbeddingCacheOptions {
	maxSizeBytes?: number; // Default: 1GB (1024 * 1024 * 1024)
	ttlMs?: number; // Default: 1 hour (3600000)
}

export interface CachedEmbedding {
	id: string;
	embeddings: Float32Array[];
	sizeBytes: number;
	createdAt: number;
	lastAccessedAt: number;
}

interface CacheEntry {
	embeddings: Float32Array[];
	sizeBytes: number;
	createdAt: number;
	lastAccessedAt: number;
}

/**
 * In-memory LRU cache for ColBERT document embeddings.
 *
 * Features:
 * - LRU eviction when size limit is reached
 * - TTL-based expiration (default: 1 hour)
 * - Size tracking in bytes
 * - Hit rate metrics
 *
 * This cache prevents redundant re-encoding of frequently accessed documents,
 * significantly improving reranking performance for repeated queries.
 */
export class EmbeddingCache {
	private cache: Map<string, CacheEntry> = new Map();
	private accessOrder: string[] = []; // LRU tracking
	private currentSizeBytes = 0;
	private readonly maxSizeBytes: number;
	private readonly ttlMs: number;
	private hits = 0;
	private misses = 0;
	private evictions = 0;
	private logger = createLogger({ component: "EmbeddingCache" });

	constructor(options?: EmbeddingCacheOptions) {
		this.maxSizeBytes = options?.maxSizeBytes ?? RERANK_CONFIG.cache.maxCacheSize;
		this.ttlMs = options?.ttlMs ?? RERANK_CONFIG.cache.documentRepresentationTTL * 1000;

		this.logger.info({
			msg: "EmbeddingCache initialized",
			maxSizeBytes: this.maxSizeBytes,
			ttlMs: this.ttlMs,
		});
	}

	/**
	 * Get cached embedding, returns null if not found or expired.
	 */
	get(documentId: string): Float32Array[] | null {
		const entry = this.cache.get(documentId);

		if (!entry) {
			this.misses++;
			recordEmbeddingCacheMiss();
			this.updateMetrics();
			return null;
		}

		// Check if entry has expired
		const now = Date.now();
		if (now - entry.createdAt > this.ttlMs) {
			// Entry expired, remove it
			this.remove(documentId);
			this.misses++;
			recordEmbeddingCacheMiss();
			this.updateMetrics();
			return null;
		}

		// Update access time and LRU order
		entry.lastAccessedAt = now;
		this.updateAccessOrder(documentId);

		this.hits++;
		recordEmbeddingCacheHit();
		this.updateMetrics();
		return entry.embeddings;
	}

	/**
	 * Store embedding in cache.
	 * Evicts oldest entries if size limit is exceeded.
	 */
	set(documentId: string, embeddings: Float32Array[]): void {
		// Calculate size of embeddings
		const sizeBytes = this.calculateSize(embeddings);

		// Check if already cached (update scenario)
		const existing = this.cache.get(documentId);
		if (existing) {
			// Update existing entry
			this.currentSizeBytes -= existing.sizeBytes;
			this.currentSizeBytes += sizeBytes;

			existing.embeddings = embeddings;
			existing.sizeBytes = sizeBytes;
			existing.lastAccessedAt = Date.now();

			this.updateAccessOrder(documentId);
			return;
		}

		// Evict if necessary to make room
		while (this.currentSizeBytes + sizeBytes > this.maxSizeBytes && this.accessOrder.length > 0) {
			const oldestId = this.accessOrder[0];
			this.remove(oldestId);
			this.evictions++;
			recordEmbeddingCacheEviction();
		}

		// Add new entry
		const now = Date.now();
		this.cache.set(documentId, {
			embeddings,
			sizeBytes,
			createdAt: now,
			lastAccessedAt: now,
		});

		this.accessOrder.push(documentId);
		this.currentSizeBytes += sizeBytes;
		this.updateMetrics();
	}

	/**
	 * Invalidate specific document (on update).
	 */
	invalidate(documentId: string): void {
		this.remove(documentId);
	}

	/**
	 * Clear entire cache.
	 */
	clear(): void {
		this.cache.clear();
		this.accessOrder = [];
		this.currentSizeBytes = 0;
		this.hits = 0;
		this.misses = 0;
		this.evictions = 0;

		this.logger.info({ msg: "Cache cleared" });
	}

	/**
	 * Get cache statistics.
	 */
	getStats(): { size: number; count: number; hitRate: number } {
		const total = this.hits + this.misses;
		const hitRate = total > 0 ? this.hits / total : 0;

		return {
			size: this.currentSizeBytes,
			count: this.cache.size,
			hitRate,
		};
	}

	/**
	 * Get detailed metrics for monitoring.
	 */
	getMetrics() {
		const stats = this.getStats();
		return {
			hits: this.hits,
			misses: this.misses,
			evictions: this.evictions,
			maxSize: this.maxSizeBytes,
			...stats,
		};
	}

	/**
	 * Remove an entry from the cache.
	 */
	private remove(documentId: string): void {
		const entry = this.cache.get(documentId);
		if (!entry) return;

		this.cache.delete(documentId);
		this.currentSizeBytes -= entry.sizeBytes;

		// Remove from access order
		const index = this.accessOrder.indexOf(documentId);
		if (index !== -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	/**
	 * Update LRU access order.
	 * Move accessed item to end of list.
	 */
	private updateAccessOrder(documentId: string): void {
		const index = this.accessOrder.indexOf(documentId);
		if (index !== -1) {
			this.accessOrder.splice(index, 1);
		}
		this.accessOrder.push(documentId);
	}

	/**
	 * Calculate size of embeddings in bytes.
	 * Float32Array uses 4 bytes per element.
	 */
	private calculateSize(embeddings: Float32Array[]): number {
		let totalBytes = 0;
		for (const embedding of embeddings) {
			totalBytes += embedding.length * 4; // 4 bytes per float32
		}
		return totalBytes;
	}

	/**
	 * Update Prometheus metrics with current cache state.
	 */
	private updateMetrics(): void {
		embeddingCacheSize.set(this.currentSizeBytes);
		embeddingCacheCount.set(this.cache.size);
		const hitRate = computeHitRate(this.hits, this.misses);
		embeddingCacheHitRate.set(hitRate);
	}
}
