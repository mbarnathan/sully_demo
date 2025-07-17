# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js TypeScript application demonstrating advanced patterns for voice agents using the OpenAI Realtime API and the OpenAI Agents SDK. The project showcases two main agentic patterns:

1. **Chat-Supervisor Pattern**: A realtime chat agent handles basic interactions while a supervisor model (gpt-4.1) manages complex tool calls and responses
2. **Sequential Handoff Pattern**: Specialized agents transfer users between them to handle specific intents, inspired by OpenAI Swarm

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Environment Setup

- Copy `.env.sample` to `.env` and add your `OPENAI_API_KEY`
- Or set `OPENAI_API_KEY` in your environment variables
- The app runs on http://localhost:3000

## Architecture Overview

### Core Components

- **App.tsx**: Main application component managing session state, agent selection, and UI coordination
- **Agent Configs** (`src/app/agentConfigs/`): Defines different agent scenarios and their behaviors
- **Realtime Session Hook** (`src/app/hooks/useRealtimeSession.ts`): Manages WebRTC connection to OpenAI Realtime API
- **Session API** (`src/app/api/session/route.ts`): Server endpoint for creating ephemeral OpenAI sessions

### Agent Configuration Structure

Agent configs are organized in `src/app/agentConfigs/` with three main scenarios:

1. **chatSupervisor/**: Chat-supervisor pattern implementation
2. **customerServiceRetail/**: Complex multi-agent customer service flow
3. **simpleHandoff/**: Basic agent handoff demonstration

Each agent config exports an array of `RealtimeAgent` objects that define:
- Instructions and behavior
- Available tools
- Handoff capabilities to other agents

### Key Patterns

- **Agent Handoffs**: Agents can transfer users via `agent_transfer` tool calls
- **Tool Integration**: Custom tools defined per agent with logic in tool handlers
- **Guardrails**: Output moderation using `createModerationGuardrail()`
- **Context Management**: Session history and transcript tracking through React contexts

### Transport Layer

- Uses OpenAI Realtime WebRTC for low-latency audio streaming
- Supports codec selection (Opus 48kHz, PCMU/PCMA 8kHz) for testing phone-line quality
- Handles audio transcription, interruption, and push-to-talk modes

## Adding New Agent Scenarios

1. Create new agent config file in `src/app/agentConfigs/`
2. Define agents using `RealtimeAgent` class from `@openai/agents/realtime`
3. Export agent array and add to `src/app/agentConfigs/index.ts`
4. Scenario will appear in UI dropdown automatically

## Testing Voice Agents

- Use the Scenario dropdown to switch between agent configurations
- Agent dropdown allows direct selection of specific agents within a scenario
- Event log on right side shows full client/server event stream
- Transcript on left shows conversation history with tool calls
- Bottom toolbar controls connection, PTT/VAD, and audio playback

- Write unit tests and make dependent classes mockable where possible.
- Prefer isolated tests over end-to-end tests, particularly where external APIs may be called.
- Place tests under the `src/app/tests/` directory structure.

## Model Configuration

- Default realtime model: `gpt-4o-realtime-preview-2025-06-03`
- Supervisor model (chat-supervisor pattern): `gpt-4o`
- Transcription model: `gpt-4o-mini-transcribe`
- Models are configured in `useRealtimeSession.ts` and agent configs

## Memory and RAG System

The app includes a comprehensive memory system with vector storage and RAG capabilities:

### Components
- **Vector Store**: ChromaDB for semantic search and embedding storage
- **Memory Service**: Singleton service managing memory operations with LlamaIndex
- **Memory Tools**: Agent-accessible tools for search, storage, and retrieval
- **API Endpoints**: REST API for memory management at `/api/memory`

### Memory Types
- **Facts**: Objective information about users or topics
- **Preferences**: User preferences and settings  
- **Context**: Background information and situational context
- **Conversations**: Chat history and dialogue turns

### Setup
1. Start ChromaDB: `docker-compose up -d chroma`
2. Environment variables: `OPENAI_API_KEY`, `CHROMA_URL`, `CHROMA_COLLECTION`
3. Memory system auto-initializes on first access

### Agent Integration
- Agents can search memory using `searchMemory` tool
- Store important information with `storeMemory` tool
- Get conversation context with `getConversationContext` tool
- Chat supervisor agent automatically uses memory for context

### Usage
```typescript
// Search for user preferences
const results = await searchMemory("user notification preferences", {
  types: ["preference"],
  limit: 5
});

// Store important fact
await storeMemory("User prefers email over SMS", "preference", {
  importance: 4,
  tags: ["notifications"]
});
```

See `README_MEMORY.md` for detailed setup and usage instructions.
