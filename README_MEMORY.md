# Voice Agent Memory System

This document describes the memory and RAG (Retrieval-Augmented Generation) capabilities added to the voice agents.

## Overview

The memory system provides:
- **Vector-based memory storage** using ChromaDB for semantic search
- **Structured memory types** for facts, preferences, context, and conversations
- **RAG tools** for agents to query and store memories
- **Conversation persistence** across sessions
- **Importance-based filtering** for memory relevance

## Architecture

### Core Components

1. **Memory Service** (`src/app/lib/memory/service.ts`)
   - Singleton service managing memory operations
   - Handles embedding, storage, and retrieval
   - Provides conversation-specific memory management

2. **Vector Store** (`src/app/lib/memory/config.ts`)
   - ChromaDB integration with OpenAI embeddings
   - Configurable collection management
   - Connection pooling and error handling

3. **Memory Tools** (`src/app/lib/memory/tools.ts`)
   - Agent-accessible tools for memory operations
   - Structured parameters for search and storage
   - Integration with OpenAI Agents SDK

4. **API Endpoints** (`src/app/api/memory/route.ts`)
   - REST API for memory operations
   - Search, store, and management endpoints
   - Conversation history tracking

## Setup

### 1. Start ChromaDB

```bash
# Using Docker Compose (recommended)
docker-compose up -d chroma

# Or using Docker directly
docker run -p 8000:8000 chromadb/chroma:latest
```

### 2. Environment Variables

Add to your `.env` file:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional - defaults to localhost:8000
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=voice_agent_memory
```

### 3. Initialize Memory System

The memory system auto-initializes when first accessed. You can also manually initialize:

```typescript
import { initializeMemorySystem } from './src/app/lib/memory';

await initializeMemorySystem();
```

## Memory Types

The system supports four types of memory:

1. **Facts** - Objective information about users or topics
2. **Preferences** - User preferences and settings
3. **Context** - Background information and situational context
4. **Conversations** - Chat history and dialogue turns

## Agent Integration

### Available Tools

Agents now have access to these memory tools:

1. **searchMemory** - Search through memories using semantic similarity
2. **getConversationContext** - Get comprehensive context for a conversation
3. **storeMemory** - Store important information for future reference
4. **getMemoryStats** - Get usage statistics

### Usage Examples

```typescript
// Search for user preferences
const preferences = await searchMemory({
  query: "user preferences settings",
  memoryTypes: ["preference"],
  limit: 5
});

// Store an important fact
await storeMemory({
  content: "User prefers email notifications over SMS",
  type: "preference",
  conversationId: "conv-123",
  importance: 4,
  tags: ["notifications", "communication"]
});

// Get conversation context
const context = await getConversationContext({
  conversationId: "conv-123",
  userId: "user-456"
});
```

## Supervisor Agent Enhancement

The chat supervisor agent now:
- Searches memory before responding to queries
- Stores important facts and preferences automatically
- Uses conversation context to provide personalized responses
- Maintains conversation continuity across sessions

## API Usage

### Search Memory
```bash
GET /api/memory?query=user preferences&types=preference,fact&limit=10
```

### Store Memory
```bash
POST /api/memory
{
  "action": "store",
  "content": "User prefers morning appointments",
  "type": "preference",
  "conversationId": "conv-123",
  "importance": 3,
  "tags": ["scheduling", "appointments"]
}
```

### Get Conversation Memory
```bash
GET /api/memory?action=conversation&conversationId=conv-123&userId=user-456
```

### Reset Memory Store
```bash
DELETE /api/memory?action=reset
```

## React Hook

Use the `useMemory` hook in React components:

```typescript
import { useMemory } from './hooks/useMemory';

function MyComponent() {
  const { searchMemory, storeMemory, isLoading, error } = useMemory();
  
  const handleSearch = async () => {
    const results = await searchMemory("user preferences", {
      types: ["preference"],
      limit: 5
    });
    console.log(results);
  };
  
  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      <button onClick={handleSearch}>Search Memory</button>
    </div>
  );
}
```

## Development

### Testing Memory System

1. Start ChromaDB: `docker-compose up -d chroma`
2. Run the app: `npm run dev`
3. Test with a conversation that includes storing and retrieving information

### Memory Persistence

- ChromaDB data persists in Docker volume `chroma_data`
- Memory survives app restarts
- Use `DELETE /api/memory?action=reset` to clear all memory

### Performance Considerations

- Embeddings are generated for all stored content
- Search results are limited to prevent large responses
- Memory is filtered by importance and relevance
- Consider implementing memory cleanup for old conversations

## Troubleshooting

### ChromaDB Connection Issues
- Ensure ChromaDB is running: `docker ps`
- Check URL configuration in `.env`
- Verify port 8000 is available

### Memory Not Persisting
- Check Docker volume mounting
- Verify ChromaDB container has write permissions
- Review Docker logs: `docker logs <chroma_container>`

### Poor Search Results
- Increase similarity threshold
- Add more descriptive tags
- Use more specific search queries
- Adjust importance scoring

## Future Enhancements

- Automatic memory summarization
- Memory expiration policies
- User-specific memory namespacing
- Memory analytics and insights
- Multi-modal memory support