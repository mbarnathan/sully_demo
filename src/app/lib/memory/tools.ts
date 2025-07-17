import { tool } from '@openai/agents/realtime';
import { MemoryService } from './service';
import { MemoryQuery } from './types';

export const searchMemoryTool = tool({
  name: 'searchMemory',
  description: 'Search through conversation memory and knowledge base to find relevant information, past conversations, user preferences, and context.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant memories. Use natural language describing what you are looking for.',
      },
      conversationId: {
        type: 'string',
        description: 'Optional conversation ID to limit search to a specific conversation.',
      },
      userId: {
        type: 'string',
        description: 'Optional user ID to limit search to a specific user.',
      },
      memoryTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['conversation', 'fact', 'preference', 'context']
        },
        description: 'Types of memory to search through. Defaults to all types.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5).',
        default: 5,
      },
      timeRange: {
        type: 'object',
        properties: {
          hours: {
            type: 'number',
            description: 'Search within the last N hours',
          },
          days: {
            type: 'number',
            description: 'Search within the last N days',
          },
        },
        description: 'Optional time range to limit search',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (input) => {
    const {
      query,
      conversationId,
      userId,
      memoryTypes,
      limit = 5,
      timeRange
    } = input as {
      query: string;
      conversationId?: string;
      userId?: string;
      memoryTypes?: string[];
      limit?: number;
      timeRange?: { hours?: number; days?: number };
    };

    try {
      const memoryService = MemoryService.getInstance();

      // Build query filters
      const filters: MemoryQuery['filters'] = {};

      if (conversationId) {
        filters.conversationId = conversationId;
      }

      if (userId) {
        filters.userId = userId;
      }

      if (memoryTypes && memoryTypes.length > 0) {
        filters.type = memoryTypes;
      }

      if (timeRange) {
        const now = Date.now();
        let start = now;

        if (timeRange.hours) {
          start = now - (timeRange.hours * 60 * 60 * 1000);
        } else if (timeRange.days) {
          start = now - (timeRange.days * 24 * 60 * 60 * 1000);
        }

        filters.timeRange = { start, end: now };
      }

      const results = await memoryService.queryMemory({
        query,
        filters,
        limit,
      });

      // Format results for agent consumption
      const formattedResults = results.map(result => ({
        content: result.document.content,
        relevance: result.similarity,
        timestamp: new Date(result.document.metadata.timestamp).toISOString(),
        type: result.document.metadata.type,
        importance: result.document.metadata.importance,
        tags: result.document.metadata.tags,
        summary: result.document.metadata.summary,
      }));

      return {
        results: formattedResults,
        totalFound: results.length,
        query: query,
      };
    } catch (error) {
      console.error('Error searching memory:', error);
      return {
        error: 'Failed to search memory',
        results: [],
        totalFound: 0,
        query: query,
      };
    }
  },
});

export const getConversationContextTool = tool({
  name: 'getConversationContext',
  description: 'Retrieve comprehensive context for a conversation including facts, preferences, and recent history.',
  parameters: {
    type: 'object',
    properties: {
      conversationId: {
        type: 'string',
        description: 'The conversation ID to get context for.',
      },
      userId: {
        type: 'string',
        description: 'Optional user ID to get user-specific context.',
      },
    },
    required: ['conversationId'],
    additionalProperties: false,
  },
  execute: async (input, _details) => {
    const { conversationId, userId } = input as {
      conversationId: string;
      userId?: string;
    };

    try {
      const memoryService = MemoryService.getInstance();
      const context = await memoryService.getConversationMemory(conversationId, userId);

      return {
        conversationId,
        facts: context.facts.map(doc => ({
          content: doc.content,
          timestamp: new Date(doc.metadata.timestamp).toISOString(),
          importance: doc.metadata.importance,
          tags: doc.metadata.tags,
        })),
        preferences: context.preferences.map(doc => ({
          content: doc.content,
          timestamp: new Date(doc.metadata.timestamp).toISOString(),
          importance: doc.metadata.importance,
          tags: doc.metadata.tags,
        })),
        context: context.context.map(doc => ({
          content: doc.content,
          timestamp: new Date(doc.metadata.timestamp).toISOString(),
          importance: doc.metadata.importance,
          tags: doc.metadata.tags,
        })),
        recentConversations: context.recentConversations.map(doc => ({
          content: doc.content,
          timestamp: new Date(doc.metadata.timestamp).toISOString(),
          type: doc.metadata.type,
          tags: doc.metadata.tags,
        })),
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return {
        error: 'Failed to get conversation context',
        conversationId,
        facts: [],
        preferences: [],
        context: [],
        recentConversations: [],
      };
    }
  },
});

export const storeMemoryTool = tool({
  name: 'storeMemory',
  description: 'Store important information, facts, or preferences in long-term memory for future reference.',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to store in memory.',
      },
      type: {
        type: 'string',
        enum: ['fact', 'preference', 'context'],
        description: 'The type of information being stored.',
      },
      conversationId: {
        type: 'string',
        description: 'The conversation ID this memory is associated with.',
      },
      userId: {
        type: 'string',
        description: 'Optional user ID this memory is associated with.',
      },
      importance: {
        type: 'number',
        minimum: 1,
        maximum: 5,
        description: 'Importance level of this memory (1-5, where 5 is most important).',
        default: 3,
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to categorize this memory.',
      },
      summary: {
        type: 'string',
        description: 'Optional brief summary of the memory content.',
      },
    },
    required: ['content', 'type', 'conversationId'],
    additionalProperties: false,
  },
  execute: async (input, details) => {
    const {
      content,
      type,
      conversationId,
      userId,
      importance = 3,
      tags = [],
      summary
    } = input as {
      content: string;
      type: 'fact' | 'preference' | 'context';
      conversationId: string;
      userId?: string;
      importance?: number;
      tags?: string[];
      summary?: string;
    };

    try {
      const memoryService = MemoryService.getInstance();

      const memoryId = await memoryService.storeMemory({
        content,
        metadata: {
          timestamp: Date.now(),
          conversationId,
          userId,
          agentName: (details?.context as any)?.agentName,
          type,
          importance,
          tags,
          summary,
        },
      });

      return {
        memoryId,
        status: 'stored',
        content,
        type,
        importance,
        tags,
      };
    } catch (error) {
      console.error('Error storing memory:', error);
      return {
        error: 'Failed to store memory',
        status: 'failed',
        content,
        type,
      };
    }
  },
});

export const getMemoryStatsTool = tool({
  name: 'getMemoryStats',
  description: 'Get statistics about the memory store including total documents, types, and usage patterns.',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
    required: [],
  },
  execute: async (_input, _details) => {
    try {
      const memoryService = MemoryService.getInstance();
      const stats = await memoryService.getMemoryStats();

      return {
        totalDocuments: stats.totalDocuments,
        documentsByType: stats.documentsByType,
        oldestDocument: new Date(stats.oldestDocument).toISOString(),
        newestDocument: new Date(stats.newestDocument).toISOString(),
        averageImportance: stats.averageImportance,
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        error: 'Failed to get memory statistics',
        totalDocuments: 0,
        documentsByType: {},
      };
    }
  },
});

// Export all memory tools as a convenient array
export const memoryTools = [
  searchMemoryTool,
  getConversationContextTool,
  storeMemoryTool,
  getMemoryStatsTool,
];
