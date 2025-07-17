import { ChromaVectorStore } from "llamaindex";
import { OpenAIEmbedding } from "llamaindex";
import { ChromaClient } from "chromadb";

export interface MemoryConfig {
  chromaUrl: string;
  collectionName: string;
  embeddingModel: string;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  chromaUrl: process.env.CHROMA_URL || "http://localhost:8000",
  collectionName: process.env.CHROMA_COLLECTION || "voice_agent_memory",
  embeddingModel: "text-embedding-3-small",
};

let chromaClient: ChromaClient | null = null;
let vectorStore: ChromaVectorStore | null = null;
let embedding: OpenAIEmbedding | null = null;

export async function initializeMemoryStore(config: MemoryConfig = DEFAULT_MEMORY_CONFIG) {
  try {
    // Initialize ChromaDB client
    chromaClient = new ChromaClient({
      path: config.chromaUrl,
    });

    // Initialize OpenAI embedding
    embedding = new OpenAIEmbedding({
      model: config.embeddingModel,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize vector store
    vectorStore = new ChromaVectorStore({
      chromaClient,
      collectionName: config.collectionName,
    });

    console.log(`Memory store initialized with collection: ${config.collectionName}`);
    return { chromaClient, vectorStore, embedding };
  } catch (error) {
    console.error("Failed to initialize memory store:", error);
    throw error;
  }
}

export function getMemoryStore() {
  if (!vectorStore || !embedding) {
    throw new Error("Memory store not initialized. Call initializeMemoryStore() first.");
  }
  return { vectorStore, embedding, chromaClient };
}

export async function resetMemoryStore(config: MemoryConfig = DEFAULT_MEMORY_CONFIG) {
  if (chromaClient) {
    try {
      await chromaClient.deleteCollection({ name: config.collectionName });
      console.log(`Deleted collection: ${config.collectionName}`);
    } catch {
      console.warn("Collection may not exist, continuing with reset");
    }
  }
  
  // Re-initialize
  return initializeMemoryStore(config);
}