import { Database } from '../db/database'
import logger from '../services/Logger'

export interface SearchResult {
  id: string
  chunkText: string
  meetingId: number
  similarity: number
}

/**
 * SQLite-backed vector store for RAG.
 * Stores 768-dimensional embeddings as Float32Array BLOBs.
 * Uses pure JS cosine similarity for search (fast for <10K chunks).
 */
export class VectorStore {
  private database: Database

  constructor(database: Database) {
    this.database = database
  }

  /** Store a chunk embedding */
  store(id: string, meetingId: number, chunkText: string, embedding: number[]): void {
    const buffer = Buffer.from(new Float32Array(embedding).buffer)
    this.database.saveEmbedding(id, meetingId, chunkText, buffer)
  }

  /** Search for similar chunks within a specific meeting */
  searchMeeting(queryEmbedding: number[], meetingId: number, topK: number = 10): SearchResult[] {
    const rows = this.database.getEmbeddings(meetingId)
    return this.rankResults(queryEmbedding, rows, topK)
  }

  /** Search across all meetings */
  searchGlobal(queryEmbedding: number[], topK: number = 10): SearchResult[] {
    const rows = this.database.getAllEmbeddings()
    return this.rankResults(queryEmbedding, rows as any[], topK)
  }

  private rankResults(
    queryEmbedding: number[],
    rows: { id: string; chunk_text: string; embedding: Buffer; meeting_id?: number }[],
    topK: number
  ): SearchResult[] {
    const scored = rows.map(row => {
      // Convert BLOB back to Float32Array
      const storedBuffer = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
      )
      const similarity = this.cosineSimilarity(queryEmbedding, Array.from(storedBuffer))

      return {
        id: row.id,
        chunkText: row.chunk_text,
        meetingId: (row as any).meeting_id || 0,
        similarity,
      }
    })

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }
}
