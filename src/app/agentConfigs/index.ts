import { realtimeTranslationScenario } from './realtimeTranslation';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  realtimeTranslation: realtimeTranslationScenario,
};

export const defaultAgentSetKey = 'realtimeTranslation';
