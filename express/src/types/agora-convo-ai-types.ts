export enum TTSVendor {
  Microsoft = 'microsoft',
  ElevenLabs = 'elevenlabs',
}

// Agora API response body
export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  state: string;
}

// Agora API request body
export interface AgoraStartRequest {
  name: string;
  properties: {
    channel: string;
    token: string;
    agent_rtc_uid: string;
    remote_rtc_uids: string[];
    enable_string_uid?: boolean;
    idle_timeout?: number;
    advanced_features?: {
      enable_aivad?: boolean;
      enable_bhvs?: boolean;
    };
    asr: {
      language: string;
      task?: string;
    };
    llm: {
      url?: string;
      api_key?: string;
      system_messages: Array<{
        role: string;
        content: string;
      }>;
      greeting_message: string;
      failure_message: string;
      max_history?: number;
      input_modalities?: string[];
      output_modalities?: string[];
      params: {
        model: string;
        max_tokens: number;
        temperature?: number;
        top_p?: number;
      };
    };
    vad: {
      silence_duration_ms: number;
      speech_duration_ms?: number;
      threshold?: number;
      interrupt_duration_ms?: number;
      prefix_padding_ms?: number;
    };
    tts: TTSConfig;
  };
}

export interface TTSConfig {
  vendor: TTSVendor;
  params: MicrosoftTTSParams | ElevenLabsTTSParams;
}

export interface AgoraTokenData {
  token: string;
  uid: string;
  channel: string;
  agentId?: string;
}

interface MicrosoftTTSParams {
  key: string;
  region: string;
  voice_name: string;
  rate?: number;
  volume?: number;
}

interface ElevenLabsTTSParams {
  api_key: string;
  voice_id: string;
  model_id: string;
}
