import { useCallback, useState } from 'react';
import { MemorySearchResult, ConversationMemory } from '../lib/memory/types';

export interface MemoryHookResult {
  searchMemory: (query: string, options?: SearchOptions) => Promise<MemorySearchResult[]>;
  storeMemory: (content: string, type: string, options?: StoreOptions) => Promise<string>;
  getConversationMemory: (conversationId: string, userId?: string) => Promise<ConversationMemory>;
  storeConversationTurn: (userMessage: string, assistantMessage: string, context: ConversationContext) => Promise<any>;
  isLoading: boolean;
  error: string | null;
}

interface SearchOptions {
  conversationId?: string;
  userId?: string;
  types?: string[];
  limit?: number;
}

interface StoreOptions {
  conversationId?: string;
  userId?: string;
  importance?: number;
  tags?: string[];
  summary?: string;
}

interface ConversationContext {
  conversationId: string;
  userId?: string;
  agentName?: string;
}

export function useMemory(): MemoryHookResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMemory = useCallback(async (query: string, options: SearchOptions = {}): Promise<MemorySearchResult[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        query,
        ...(options.conversationId && { conversationId: options.conversationId }),
        ...(options.userId && { userId: options.userId }),
        ...(options.types && { types: options.types.join(',') }),
        ...(options.limit && { limit: options.limit.toString() }),
      });
      
      const response = await fetch(`/api/memory?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.results.map((result: any, index: number) => ({
        document: {
          id: `result-${index}`,
          content: result.content,
          metadata: {
            timestamp: result.timestamp,
            type: result.type,
            importance: result.importance,
            tags: result.tags,
          },
        },
        similarity: result.similarity,
        rank: index + 1,
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error searching memory:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const storeMemory = useCallback(async (content: string, type: string, options: StoreOptions = {}): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'store',
          content,
          type,
          conversationId: options.conversationId || 'default',
          userId: options.userId,
          importance: options.importance,
          tags: options.tags,
          summary: options.summary,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.memoryId;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error storing memory:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getConversationMemory = useCallback(async (conversationId: string, userId?: string): Promise<ConversationMemory> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        action: 'conversation',
        conversationId,
        ...(userId && { userId }),
      });
      
      const response = await fetch(`/api/memory?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error getting conversation memory:', err);
      return {
        facts: [],
        preferences: [],
        context: [],
        recentConversations: [],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const storeConversationTurn = useCallback(async (
    userMessage: string,
    assistantMessage: string,
    context: ConversationContext
  ): Promise<any> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'conversation',
          userMessage,
          assistantMessage,
          conversationId: context.conversationId,
          userId: context.userId,
          agentName: context.agentName,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error storing conversation turn:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    searchMemory,
    storeMemory,
    getConversationMemory,
    storeConversationTurn,
    isLoading,
    error,
  };
}