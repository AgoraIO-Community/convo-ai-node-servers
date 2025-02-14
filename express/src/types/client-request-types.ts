export interface InviteAgentRequest {
  requester_id: string | number;
  channel_name: string;
  rtc_codec?: number;
  input_modalities?: string[];
  output_modalities?: string[];
}

export interface RemoveAgentRequest {
  agent_id: string;
}
