import { EmbeddingPipeline } from './EmbeddingPipeline'
import { VectorStore, type SearchResult } from './VectorStore'
import logger from '../services/Logger'

/**
 * 3-stage RAG retrieval pipeline:
 * 1. Embed the query
 * 2. Overfetch candidates (3x topK)
 * 3. Rerank by semantic similarity + keyword overlap
 */
export class RAGRetriever {
  private embeddingPipeline: EmbeddingPipeline
  private vectorStore: VectorStore

  constructor(embeddingPipeline: EmbeddingPipeline, vectorStore: VectorStore) {
    this.embeddingPipeline = embeddingPipeline
    this.vectorStore = vectorStore
  }

  /** Check if RAG is available (needs embedding pipeline) */
  isAvailable(): boolean {
    return this.embeddingPipeline.isAvailable()
  }

  /**
   * Retrieve relevant context chunks for a query within a specific meeting.
   */
  async retrieveFromMeeting(query: string, meetingId: number, topK: number = 5): Promise<string[]> {
    if (!this.isAvailable()) {
      logger.warn('RAG', 'Embedding pipeline not available')
      return []
    }

    try {
      // Stage 1: Embed the query
      const queryEmbedding = await this.embeddingPipeline.embed(query)

      // Stage 2: Overfetch candidates (3x topK)
      const candidates = this.vectorStore.searchMeeting(queryEmbedding, meetingId, topK * 3)

      if (candidates.length === 0) {
        logger.debug('RAG', `No embeddings found for meeting ${meetingId}`)
        return []
      }

      // Stage 3: Rerank with keyword overlap
      const reranked = this.rerank(query, candidates)

      const results = reranked.slice(0, topK).map(r => r.chunkText)
      logger.info('RAG', `Retrieved ${results.length} chunks for meeting ${meetingId} (from ${candidates.length} candidates)`)
      return results
    } catch (err) {
      logger.error('RAG', 'Retrieval failed', err)
      return []
    }
  }

  /**
   * Retrieve relevant context across all meetings.
   */
  async retrieveGlobal(query: string, topK: number = 5): Promise<string[]> {
    if (!this.isAvailable()) return []

    try {
      const queryEmbedding = await this.embeddingPipeline.embed(query)
      const candidates = this.vectorStore.searchGlobal(queryEmbedding, topK * 3)

      if (candidates.length === 0) return []

      const reranked = this.rerank(query, candidates)
      return reranked.slice(0, topK).map(r => r.chunkText)
    } catch (err) {
      logger.error('RAG', 'Global retrieval failed', err)
      return []
    }
  }

  private rerank(query: string, candidates: SearchResult[]): (SearchResult & { rerankedScore: number })[] {
    const queryWords = new Set(
      query.toLowerCase().split(/\W+/).filter(w => w.length > 2)
    )

    return candidates
      .map(c => {
        const chunkWords = c.chunkText.toLowerCase().split(/\W+/)
        const overlap = chunkWords.filter(w => queryWords.has(w)).length
        const keywordScore = queryWords.size > 0 ? overlap / queryWords.size : 0

        // Weighted combination: 70% semantic similarity, 30% keyword overlap
        const rerankedScore = c.similarity * 0.7 + keywordScore * 0.3

        return { ...c, rerankedScore }
      })
      .sort((a, b) => b.rerankedScore - a.rerankedScore)
  }
}
