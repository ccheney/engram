import { describe, expect, it } from "vitest";
import { BaseTagExtractor, type TagExtractorConfig } from "./base";

/**
 * Test implementation of BaseTagExtractor for unit testing.
 */
class TestExtractor extends BaseTagExtractor<"thought"> {
	protected readonly config: TagExtractorConfig<"thought"> = {
		openTag: "[START]",
		closeTag: "[END]",
		fieldName: "thought",
		includeMarkers: false,
	};
}

class TestExtractorWithMarkers extends BaseTagExtractor<"diff"> {
	protected readonly config: TagExtractorConfig<"diff"> = {
		openTag: "[[BEGIN]]",
		closeTag: "[[FINISH]]",
		fieldName: "diff",
		includeMarkers: true,
	};
}

describe("BaseTagExtractor", () => {
	describe("basic extraction", () => {
		it("should extract content between tags", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("Hello [START]extracted[END] world");

			expect(result.content).toBe("Hello  world");
			expect(result.thought).toBe("extracted");
		});

		it("should handle content with no tags", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("Hello world");

			expect(result.content).toBe("Hello world");
			expect(result.thought).toBeUndefined();
		});

		it("should handle multiple blocks in single chunk", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("A[START]1[END]B[START]2[END]C");

			expect(result.content).toBe("ABC");
			expect(result.thought).toBe("12");
		});

		it("should handle empty content between tags", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("Hello [START][END] world");

			expect(result.content).toBe("Hello  world");
			expect(result.thought).toBeUndefined(); // Empty string is falsy
		});
	});

	describe("streaming with partial tags", () => {
		it("should handle split open tag", () => {
			const extractor = new TestExtractor();

			const r1 = extractor.process("Hello [STA");
			expect(r1.content).toBe("Hello ");
			expect(r1.thought).toBeUndefined();

			const r2 = extractor.process("RT]extracted[END]");
			// When the tag completes, content is empty (no text outside tags in this chunk)
			expect(r2.content).toBeUndefined();
			expect(r2.thought).toBe("extracted");
		});

		it("should handle split close tag", () => {
			const extractor = new TestExtractor();

			const r1 = extractor.process("Hello [START]extracted[EN");
			expect(r1.content).toBe("Hello ");
			// The extracted content is returned when we have the complete tag
			// Even though close tag is partial, we return what we have so far
			expect(r1.thought).toBe("extracted");

			const r2 = extractor.process("D] world");
			expect(r2.content).toBe(" world");
			expect(r2.thought).toBeUndefined();
		});

		it("should handle tag split across multiple chunks", () => {
			const extractor = new TestExtractor();

			const r1 = extractor.process("Before [");
			expect(r1.content).toBe("Before ");

			const r2 = extractor.process("S");
			// Single character added to partial match buffer
			expect(r2.content).toBeUndefined();

			const r3 = extractor.process("TART]inside[END] after");
			expect(r3.content).toBe(" after");
			expect(r3.thought).toBe("inside");
		});
	});

	describe("includeMarkers option", () => {
		it("should include markers when configured", () => {
			const extractor = new TestExtractorWithMarkers();
			const result = extractor.process("Text [[BEGIN]]content[[FINISH]] more");

			expect(result.content).toBe("Text  more");
			expect(result.diff).toBe("[[BEGIN]]content[[FINISH]]");
		});

		it("should include markers with streaming", () => {
			const extractor = new TestExtractorWithMarkers();

			const r1 = extractor.process("Text [[BEG");
			expect(r1.content).toBe("Text ");

			const r2 = extractor.process("IN]]content[[FINISH]] more");
			expect(r2.content).toBe(" more");
			expect(r2.diff).toBe("[[BEGIN]]content[[FINISH]]");
		});
	});

	describe("reset functionality", () => {
		it("should reset state for reuse", () => {
			const extractor = new TestExtractor();

			// First use - leave in middle of block
			extractor.process("Hello [START]partial");

			// Reset
			extractor.reset();

			// Second use - should work from clean state
			const result = extractor.process("New [START]fresh[END] text");
			expect(result.content).toBe("New  text");
			expect(result.thought).toBe("fresh");
		});
	});

	describe("edge cases", () => {
		it("should handle tag at very start", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("[START]first[END]rest");

			expect(result.content).toBe("rest");
			expect(result.thought).toBe("first");
		});

		it("should handle tag at very end", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("start[START]last[END]");

			expect(result.content).toBe("start");
			expect(result.thought).toBe("last");
		});

		it("should handle only tag content", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("[START]only[END]");

			expect(result.content).toBeUndefined();
			expect(result.thought).toBe("only");
		});

		it("should handle newlines in content", () => {
			const extractor = new TestExtractor();
			const result = extractor.process("line1\n[START]thought\nwith\nnewlines[END]\nline2");

			expect(result.content).toBe("line1\n\nline2");
			expect(result.thought).toBe("thought\nwith\nnewlines");
		});
	});
});
