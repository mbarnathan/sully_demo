// Memory system exports
export { MemoryService } from './service';
export { initializeMemoryStore, getMemoryStore, resetMemoryStore } from './config';
export { memoryTools } from './tools';
export type { 
  MemoryDocument, 
  MemoryQuery, 
  MemorySearchResult, 
  ConversationMemory, 
  MemoryStats 
} from './types';

// Initialization hook for Next.js app
export async function initializeMemorySystem() {
  const { initializeMemoryStore } = await import('./config');
  const { MemoryService } = await import('./service');
  
  try {
    await initializeMemoryStore();
    await MemoryService.getInstance().initialize();
    console.log('Memory system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize memory system:', error);
    // Don't throw - allow app to continue without memory
  }
}