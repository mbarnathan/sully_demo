import { NextRequest, NextResponse } from 'next/server';
import { MemoryService } from '../../lib/memory/service';
import { initializeMemoryStore } from '../../lib/memory/config';

let memoryServiceInitialized = false;

async function ensureMemoryServiceInitialized() {
  if (!memoryServiceInitialized) {
    try {
      await initializeMemoryStore();
      await MemoryService.getInstance().initialize();
      memoryServiceInitialized = true;
    } catch (error) {
      console.error('Failed to initialize memory service:', error);
      throw error;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureMemoryServiceInitialized();
    const memoryService = MemoryService.getInstance();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'stats') {
      const stats = await memoryService.getMemoryStats();
      return NextResponse.json(stats);
    }
    
    if (action === 'conversation') {
      const conversationId = searchParams.get('conversationId');
      const userId = searchParams.get('userId');
      
      if (!conversationId) {
        return NextResponse.json(
          { error: 'conversationId is required' },
          { status: 400 }
        );
      }
      
      const memory = await memoryService.getConversationMemory(conversationId, userId || undefined);
      return NextResponse.json(memory);
    }
    
    // Default: search memory
    const query = searchParams.get('query');
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const types = searchParams.get('types')?.split(',');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!query) {
      return NextResponse.json(
        { error: 'query parameter is required' },
        { status: 400 }
      );
    }
    
    const results = await memoryService.queryMemory({
      query,
      filters: {
        conversationId: conversationId || undefined,
        userId: userId || undefined,
        type: types || undefined,
      },
      limit,
    });
    
    return NextResponse.json({
      results: results.map(r => ({
        content: r.document.content,
        similarity: r.similarity,
        timestamp: r.document.metadata.timestamp,
        type: r.document.metadata.type,
        importance: r.document.metadata.importance,
        tags: r.document.metadata.tags,
      })),
      totalFound: results.length,
    });
    
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureMemoryServiceInitialized();
    const memoryService = MemoryService.getInstance();
    
    const body = await request.json();
    const { action, ...data } = body;
    
    if (action === 'store') {
      const { content, type, conversationId, userId, importance, tags, summary } = data;
      
      if (!content || !type || !conversationId) {
        return NextResponse.json(
          { error: 'content, type, and conversationId are required' },
          { status: 400 }
        );
      }
      
      const memoryId = await memoryService.storeMemory({
        content,
        metadata: {
          timestamp: Date.now(),
          conversationId,
          userId,
          type,
          importance: importance || 3,
          tags: tags || [],
          summary,
        },
      });
      
      return NextResponse.json({ memoryId, status: 'stored' });
    }
    
    if (action === 'conversation') {
      const { userMessage, assistantMessage, conversationId, userId, agentName } = data;
      
      if (!userMessage || !assistantMessage || !conversationId) {
        return NextResponse.json(
          { error: 'userMessage, assistantMessage, and conversationId are required' },
          { status: 400 }
        );
      }
      
      const result = await memoryService.storeConversationTurn(
        userMessage,
        assistantMessage,
        { conversationId, userId, agentName }
      );
      
      return NextResponse.json(result);
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'reset') {
      await initializeMemoryStore();
      await MemoryService.getInstance().initialize();
      memoryServiceInitialized = true;
      
      return NextResponse.json({ status: 'reset' });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}