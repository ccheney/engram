import type { StreamDelta } from "./parser/interface";

export class ThinkingExtractor {
  private buffer = "";
  private inThinkingBlock = false;
  private openTag = "<thinking>";
  private closeTag = "</thinking>";

  process(chunk: string): StreamDelta {
    this.buffer += chunk;

    let content = "";
    let thought = "";

    while (this.buffer.length > 0) {
      if (!this.inThinkingBlock) {
        // Look for open tag
        const openIndex = this.buffer.indexOf(this.openTag);

        if (openIndex !== -1) {
          // Found open tag
          // Everything before is content
          content += this.buffer.slice(0, openIndex);
          // Switch state
          this.inThinkingBlock = true;
          // Remove processed part including tag
          this.buffer = this.buffer.slice(openIndex + this.openTag.length);
        } else {
          // No complete open tag found.
          // Check if we might have a partial open tag at the end
          // Only keep the potential partial tag in buffer
          let partialMatch = false;
          for (let i = 1; i < this.openTag.length; i++) {
            if (this.buffer.endsWith(this.openTag.slice(0, i))) {
              content += this.buffer.slice(0, this.buffer.length - i);
              this.buffer = this.buffer.slice(this.buffer.length - i);
              partialMatch = true;
              break;
            }
          }

          if (!partialMatch) {
            content += this.buffer;
            this.buffer = "";
          }
          break; // Need more data
        }
      } else {
        // Inside thinking block
        // Look for close tag
        const closeIndex = this.buffer.indexOf(this.closeTag);

        if (closeIndex !== -1) {
          // Found close tag
          // Everything before is thought
          thought += this.buffer.slice(0, closeIndex);
          // Switch state
          this.inThinkingBlock = false;
          // Remove processed part including tag
          this.buffer = this.buffer.slice(closeIndex + this.closeTag.length);
        } else {
          // No complete close tag found.
          // Check for partial close tag at end
          let partialMatch = false;
          for (let i = 1; i < this.closeTag.length; i++) {
            if (this.buffer.endsWith(this.closeTag.slice(0, i))) {
              thought += this.buffer.slice(0, this.buffer.length - i);
              this.buffer = this.buffer.slice(this.buffer.length - i);
              partialMatch = true;
              break;
            }
          }

          if (!partialMatch) {
            thought += this.buffer;
            this.buffer = "";
          }
          break; // Need more data
        }
      }
    }

    const delta: StreamDelta = {};
    if (content) delta.content = content;
    if (thought) {
      // thought field is now in StreamDelta interface
      delta.thought = thought;
    }

    return delta;
  }
}
