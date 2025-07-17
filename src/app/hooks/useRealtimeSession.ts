import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  // Track accumulated transcription for real-time translation
  const accumulatedTranscriptionRef = useRef<string>('');
  const lastTranslationTimeRef = useRef<number>(0);
  const isResponseInProgressRef = useRef<boolean>(false);
  const pendingTranslationRef = useRef<string>('');
  const isPTTActiveRef = useRef<boolean>(false);

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;

  // Helper function to send translation request
  const sendTranslationRequest = useCallback((textToTranslate: string) => {
    if (!sessionRef.current || !textToTranslate.trim()) return;

    isResponseInProgressRef.current = true;
    sessionRef.current.transport.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['audio', 'text'],
        instructions: `Translate this English text to Spanish immediately: "${textToTranslate.trim()}"`,
        metadata: { source: 'realtime_translation' }
      }
    });
  }, []);

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        // Reset the accumulator when transcription is completed
        accumulatedTranscriptionRef.current = '';
        break;
      }
      case "conversation.item.input_audio_transcription.delta": {
        historyHandlers.handleInputAudioTranscriptionDelta(event);

        // For real-time translation, trigger response on delta if we have enough content
        if (sessionRef.current && event.delta) {
          // Accumulate the transcription text
          accumulatedTranscriptionRef.current += event.delta;
          const now = Date.now();

          // Trigger translation if we have enough words or enough time has passed
          const words = accumulatedTranscriptionRef.current.trim().split(/\s+/);
          const shouldTranslate = words.length >= 3 ||
                                 (now - lastTranslationTimeRef.current > 1000 && words.length >= 1);

          if (shouldTranslate && accumulatedTranscriptionRef.current.trim()) {
            // If response is in progress, accumulate more text in the pending buffer
            if (isResponseInProgressRef.current) {
              // Append new text to pending, keeping the most recent content
              const newText = accumulatedTranscriptionRef.current.trim();
              pendingTranslationRef.current = pendingTranslationRef.current
                ? `${pendingTranslationRef.current} ${newText}`
                : newText;
            } else {
              // Send immediately if no response in progress
              sendTranslationRequest(accumulatedTranscriptionRef.current.trim());
            }

            // Reset the accumulator and update timing
            accumulatedTranscriptionRef.current = '';
            lastTranslationTimeRef.current = now;
          }
        }
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      case "response.done": {
        // Response is complete, we can send the next translation if pending
        isResponseInProgressRef.current = false;

        // Check if we have a pending translation to send
        if (pendingTranslationRef.current) {
          sendTranslationRequest(pendingTranslationRef.current);
          pendingTranslationRef.current = '';
        }

        logServerEvent(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      }
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  };

  useEffect(() => {
    if (sessionRef.current) {
      // Log server errors
      sessionRef.current.on("error", (...args: any[]) => {
        logServerEvent({
          type: "error",
          message: args[0],
        });
      });

      // history events
      sessionRef.current.on("agent_handoff", handleAgentHandoff);
      sessionRef.current.on("agent_tool_start", historyHandlers.handleAgentToolStart);
      sessionRef.current.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
      sessionRef.current.on("history_updated", historyHandlers.handleHistoryUpdated);
      sessionRef.current.on("history_added", historyHandlers.handleHistoryAdded);
      sessionRef.current.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);

      // additional transport events
      sessionRef.current.on("transport_event", handleTransportEvent);
    }
  }, [sessionRef.current]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) return; // already connected

      updateStatus('CONNECTING');

      const ek = await getEphemeralKey();
      const rootAgent = initialAgents[0];

      // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
      //  simulate how the voice agent sounds over a PSTN/SIP phone call.
      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);

      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          // Set preferred codec before offer creation
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc);
            return pc;
          },
        }),
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });

      await sessionRef.current.connect({ apiKey: ek });
      // Reset translation accumulator when connecting
      accumulatedTranscriptionRef.current = '';
      lastTranslationTimeRef.current = 0;
      isResponseInProgressRef.current = false;
      pendingTranslationRef.current = '';
      isPTTActiveRef.current = false;
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);

  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    isPTTActiveRef.current = true;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    isPTTActiveRef.current = false;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
