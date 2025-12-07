export enum SearchStrategy {
  Sparse = "sparse",
  Dense = "dense",
  Hybrid = "hybrid",
}

export class QueryClassifier {
  classify(query: string): { strategy: SearchStrategy; alpha: number } {
    // Heuristic:
    // 1. Quoted strings imply exact match intent -> Sparse
    // 2. Code-like patterns (camelCase, snake_case with parens) -> Sparse/Hybrid
    // 3. Natural language -> Dense/Hybrid

    const quoted = query.match(/"([^"]*)"/g);
    if (quoted && quoted.length > 0) {
      // Strong signal for exact match
      return { strategy: SearchStrategy.Sparse, alpha: 0.1 }; // Alpha 0.1 = mostly sparse (if using reciprocal rank fusion where 0 is sparse, 1 is dense. Convention varies.)
      // Let's assume alpha is weight for Dense. So 0.1 means 10% dense, 90% sparse.
    }

    // Simple code detection
    const hasCodeSyntax = /[a-zA-Z0-9_]+\(.*\)|[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+/.test(query);
    if (hasCodeSyntax) {
      return { strategy: SearchStrategy.Hybrid, alpha: 0.3 }; // Lean towards sparse
    }

    // Default: Hybrid leaning dense
    return { strategy: SearchStrategy.Hybrid, alpha: 0.7 };
  }
}
