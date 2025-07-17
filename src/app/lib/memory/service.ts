import { Document, VectorStoreIndex, RetrieverQueryEngine } from "llamaindex";
import { getMemoryStore } from "./config";
import { 
  MemoryDocument, 
  MemoryQuery, 
  MemorySearchResult, 
  ConversationMemory, 
  MemoryStats 
} from "./types";
import { v4 as uuidv4 } from "uuid";

export class MemoryService {
  private static instance: MemoryService;
  private index: VectorStoreIndex | null = null;
  private queryEngine: RetrieverQueryEngine | null = null;

  private constructor() {}

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  async initialize(): Promise<void> {
    const { vectorStore, embedding } = getMemoryStore();
    
    // Create index from vector store
    this.index = await VectorStoreIndex.fromVectorStore(vectorStore, {
      embedModel: embedding,
    });

    // Create query engine for RAG
    this.queryEngine = this.index.asQueryEngine({
      retriever: this.index.asRetriever({
        similarityTopK: 10,
      }),
    });

    console.log("Memory service initialized");
  }

  async storeMemory(document: Omit<MemoryDocument, 'id'>): Promise<string> {
    if (!this.index) {
      throw new Error("Memory service not initialized");
    }

    const id = uuidv4();

    // Create LlamaIndex document
    const docToStore = new Document({
      text: document.content,
      metadata: {
        ...document.metadata,
        id,
      },
    });

    // Store in vector store
    await this.index.insertNodes([docToStore]);

    console.log(`Stored memory document: ${id}`);
    return id;
  }

  async storeConversationTurn(
    userMessage: string,
    assistantMessage: string,
    context: {
      conversationId: string;
      userId?: string;
      agentName?: string;
      timestamp?: number;
    }
  ): Promise<{ userMemoryId: string; assistantMemoryId: string }> {
    const timestamp = context.timestamp || Date.now();
    
    // Store user message
    const userMemoryId = await this.storeMemory({
      content: userMessage,
      metadata: {
        timestamp,
        conversationId: context.conversationId,
        userId: context.userId,
        agentName: context.agentName,
        type: 'conversation',
        importance: 3,
        tags: ['user_message'],
      },
    });

    // Store assistant message
    const assistantMemoryId = await this.storeMemory({
      content: assistantMessage,
      metadata: {
        timestamp: timestamp + 1,
        conversationId: context.conversationId,
        userId: context.userId,
        agentName: context.agentName,
        type: 'conversation',
        importance: 3,
        tags: ['assistant_message'],
      },
    });

    return { userMemoryId, assistantMemoryId };
  }

  async queryMemory(query: MemoryQuery): Promise<MemorySearchResult[]> {
    if (!this.queryEngine) {
      throw new Error("Memory service not initialized");
    }

    try {
      // Use the query engine to retrieve relevant documents
      const response = await this.queryEngine.query({
        query: query.query,
      });

      // Extract source nodes and convert to results
      const results: MemorySearchResult[] = [];
      
      if (response.sourceNodes) {
        response.sourceNodes.forEach((node, index) => {
          const metadata = node.node.metadata;
          const document: MemoryDocument = {
            id: metadata.id as string,
            content: node.node.text,
            metadata: {
              timestamp: metadata.timestamp as number,
              conversationId: metadata.conversationId as string,
              userId: metadata.userId as string,
              agentName: metadata.agentName as string,
              type: metadata.type as any,
              importance: metadata.importance as number,
              tags: metadata.tags as string[],
              summary: metadata.summary as string,
            },
          };

          results.push({
            document,
            similarity: node.score || 0,
            rank: index + 1,
          });
        });
      }

      // Apply filters
      return this.applyFilters(results, query.filters);
    } catch (error) {
      console.error("Error querying memory:", error);
      throw error;
    }
  }

  async getConversationMemory(conversationId: string, userId?: string): Promise<ConversationMemory> {
    const baseQuery: MemoryQuery = {
      query: "",
      filters: { conversationId, userId },
      limit: 100,
    };

    // Get different types of memory
    const facts = await this.queryMemory({
      ...baseQuery,
      query: "facts information knowledge",
      filters: { ...baseQuery.filters, type: ['fact'] },
    });

    const preferences = await this.queryMemory({
      ...baseQuery,
      query: "preferences likes dislikes settings",
      filters: { ...baseQuery.filters, type: ['preference'] },
    });

    const context = await this.queryMemory({
      ...baseQuery,
      query: "context background information",
      filters: { ...baseQuery.filters, type: ['context'] },
    });

    const recentConversations = await this.queryMemory({
      ...baseQuery,
      query: "recent conversation messages",
      filters: { 
        ...baseQuery.filters, 
        type: ['conversation'],
        timeRange: {
          start: Date.now() - (24 * 60 * 60 * 1000), // Last 24 hours
          end: Date.now(),
        }
      },
      limit: 20,
    });

    return {
      facts: facts.map(r => r.document),
      preferences: preferences.map(r => r.document),
      context: context.map(r => r.document),
      recentConversations: recentConversations.map(r => r.document),
    };
  }

  async summarizeConversation(conversationId: string): Promise<string> {
    const memory = await this.getConversationMemory(conversationId);
    
    // Simple summarization - in production, you'd use a summarization model
    const recentMessages = memory.recentConversations
      .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp)
      .slice(-10)
      .map(doc => doc.content)
      .join('\n');

    return `Recent conversation summary:\n${recentMessages}`;
  }

  async getMemoryStats(): Promise<MemoryStats> {
    // This would need to be implemented with ChromaDB queries
    // For now, return mock stats
    return {
      totalDocuments: 0,
      documentsByType: {},
      oldestDocument: Date.now(),
      newestDocument: Date.now(),
      averageImportance: 3,
    };
  }

  private applyFilters(results: MemorySearchResult[], filters?: MemoryQuery['filters']): MemorySearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      const { document } = result;
      const { metadata } = document;

      // Filter by conversation ID
      if (filters.conversationId && metadata.conversationId !== filters.conversationId) {
        return false;
      }

      // Filter by user ID
      if (filters.userId && metadata.userId !== filters.userId) {
        return false;
      }

      // Filter by agent name
      if (filters.agentName && metadata.agentName !== filters.agentName) {
        return false;
      }

      // Filter by type
      if (filters.type && !filters.type.includes(metadata.type)) {
        return false;
      }

      // Filter by time range
      if (filters.timeRange) {
        const { start, end } = filters.timeRange;
        if (metadata.timestamp < start || metadata.timestamp > end) {
          return false;
        }
      }

      // Filter by importance
      if (filters.importance) {
        const { min, max } = filters.importance;
        if (metadata.importance && 
            ((min && metadata.importance < min) || 
             (max && metadata.importance > max))) {
          return false;
        }
      }

      // Filter by tags
      if (filters.tags && metadata.tags) {
        const hasMatchingTag = filters.tags.some(tag => 
          metadata.tags!.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }
}