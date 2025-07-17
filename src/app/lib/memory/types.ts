export interface MemoryDocument {
  id: string;
  content: string;
  metadata: {
    timestamp: number;
    conversationId?: string;
    userId?: string;
    agentName?: string;
    type: 'conversation' | 'fact' | 'preference' | 'context';
    importance?: number; // 1-5 scale
    tags?: string[];
    summary?: string;
  };
}

export interface MemoryQuery {
  query: string;
  filters?: {
    conversationId?: string;
    userId?: string;
    agentName?: string;
    type?: string[];
    timeRange?: {
      start: number;
      end: number;
    };
    importance?: {
      min?: number;
      max?: number;
    };
    tags?: string[];
  };
  limit?: number;
  similarity_threshold?: number;
}

export interface MemorySearchResult {
  document: MemoryDocument;
  similarity: number;
  rank: number;
}

export interface ConversationMemory {
  facts: MemoryDocument[];
  preferences: MemoryDocument[];
  context: MemoryDocument[];
  recentConversations: MemoryDocument[];
}

export interface MemoryStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  oldestDocument: number;
  newestDocument: number;
  averageImportance: number;
}