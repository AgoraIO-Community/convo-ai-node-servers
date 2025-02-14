import express, { Request, Response } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import {
  AgoraStartRequest,
  TTSConfig,
  TTSVendor,
  AgentResponse,
} from '../types/agora-convo-ai-types';
import {
  InviteAgentRequest,
  RemoveAgentRequest,
} from '../types/client-request-types';

// Router instance for handling AI agent-related endpoints
const router = express.Router();

// POST /agent/invite - Start a conversation with an AI agent
// Handles the creation of a new conversation session with an AI agent
// Generates necessary tokens and configurations for real-time communication
router.post(
  '/invite',
  async (req: Request<{}, {}, InviteAgentRequest>, res: Response) => {
    try {
      // Extract required parameters from the request body
      const {
        requester_id,
        channel_name,
        input_modalities,
        output_modalities,
      } = req.body;

      const agentUid = process.env.AGENT_UID || 'Agent';

      // Generate a unique channel name using timestamp and random string
      const channelNameBase = 'conversation';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const uniqueName = `${channelNameBase}-${timestamp}-${random}`;
      const expirationTime = Math.floor(timestamp / 1000) + 3600; // Token expires in 1 hour

      // Generate a Publisher token for the agent
      const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID!,
        process.env.AGORA_APP_CERTIFICATE!,
        channel_name,
        agentUid,
        RtcRole.PUBLISHER,
        expirationTime,
        expirationTime
      );

      // Configure Text-to-Speech settings based on environment configuration
      const ttsVendor = process.env.TTS_VENDOR as TTSVendor;
      if (!ttsVendor) {
        throw new Error('TTS_VENDOR is not set');
      }
      const ttsConfig = getTTSConfig(ttsVendor);

      // Set up requester identifier, agora API expects an array of strings, even if using numeric uid
      // parameter for enable_string_uid is set by the regex test of the uid string
      const requesterUid = requester_id.toString();

      // Define AI assistant behavior and conversation parameters
      const systemMessage =
        'You are a helpful assistant. Pretend that the text input is audio, and you are responding to it. Speak fast, clearly, and concisely.';

      // Prepare the request body for Agora Conversation AI service
      const requestBody: AgoraStartRequest = {
        name: uniqueName,
        properties: {
          channel: channel_name,
          token: token,
          agent_rtc_uid: agentUid,
          remote_rtc_uids: [requesterUid],
          enable_string_uid: /[a-zA-Z]/.test(requesterUid),
          idle_timeout: 30,
          asr: {
            language: 'en-US',
            task: 'conversation',
          },
          llm: {
            url: process.env.LLM_URL,
            api_key: process.env.LLM_TOKEN,
            system_messages: [
              {
                role: 'system',
                content: systemMessage,
              },
            ],
            greeting_message: 'Hello! How can I assist you today?',
            failure_message: 'Please wait a moment.',
            max_history: 10,
            params: {
              model: process.env.LLM_MODEL!,
              max_tokens: 1024,
              temperature: 0.7,
              top_p: 0.95,
            },
            input_modalities: input_modalities ||
              process.env.INPUT_MODALITIES?.split(',') || ['text'],
            output_modalities: output_modalities ||
              process.env.OUTPUT_MODALITIES?.split(',') || ['text', 'audio'],
          },
          tts: ttsConfig,
          vad: {
            silence_duration_ms: 480,
            speech_duration_ms: 15000,
            threshold: 0.5,
            interrupt_duration_ms: 160,
            prefix_padding_ms: 300,
          },
          // These features must be enabled at account level
          // contact support to enable these features.
          advanced_features: {
            enable_aivad: false,
            enable_bhvs: false,
          },
        },
      };

      // Make API request to Agora Conversation AI service to initiate the session
      const response = await fetch(
        `${process.env.AGORA_CONVO_AI_BASE_URL}/${process.env.AGORA_APP_ID}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(
              `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`
            ).toString('base64')}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.status}`);
      }

      const data: AgentResponse = await response.json();
      res.json(data);
    } catch (error) {
      // Log and handle any errors that occur during conversation setup
      console.error('Error starting conversation:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      });
    }
  }
);

// POST /agent/remove - Remove an AI agent from conversation
// Handles the removal of an AI agent from an active conversation session
router.post(
  '/remove',
  async (req: Request<{}, {}, RemoveAgentRequest>, res: Response) => {
    try {
      // Extract and validate agent ID from request
      const { agent_id } = req.body;

      if (!agent_id) {
        throw new Error('agent_id is required');
      }

      // Prepare authentication credentials for Agora API
      const plainCredential = `${process.env.AGORA_CUSTOMER_ID}:${process.env.AGORA_CUSTOMER_SECRET}`;
      const encodedCredential = Buffer.from(plainCredential).toString('base64');

      // Make API request to remove agent from conversation
      const response = await fetch(
        `${process.env.AGORA_CONVO_AI_BASE_URL}/${process.env.AGORA_APP_ID}/agents/${agent_id}/leave`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${encodedCredential}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to remove agent: ${response.status}`);
      }

      res.json({ success: true });
    } catch (error) {
      // Log and handle any errors that occur during agent removal
      console.error('Error removing agent:', error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to remove agent',
      });
    }
  }
);

/**
 * Generates TTS configuration based on the specified vendor
 * @param vendor - The Text-to-Speech vendor (Microsoft or ElevenLabs)
 * @returns TTSConfig object with vendor-specific parameters
 * @throws Error if vendor is unsupported or required environment variables are missing
 */
function getTTSConfig(vendor: TTSVendor): TTSConfig {
  if (vendor === TTSVendor.Microsoft) {
    if (
      !process.env.MICROSOFT_TTS_KEY ||
      !process.env.MICROSOFT_TTS_REGION ||
      !process.env.MICROSOFT_TTS_VOICE_NAME ||
      !process.env.MICROSOFT_TTS_RATE ||
      !process.env.MICROSOFT_TTS_VOLUME
    ) {
      throw new Error('Missing Microsoft TTS environment variables');
    }
    return {
      vendor: TTSVendor.Microsoft,
      params: {
        key: process.env.MICROSOFT_TTS_KEY,
        region: process.env.MICROSOFT_TTS_REGION,
        voice_name: process.env.MICROSOFT_TTS_VOICE_NAME,
        rate: parseFloat(process.env.MICROSOFT_TTS_RATE),
        volume: parseFloat(process.env.MICROSOFT_TTS_VOLUME),
      },
    };
  }

  if (vendor === TTSVendor.ElevenLabs) {
    if (
      !process.env.ELEVENLABS_API_KEY ||
      !process.env.ELEVENLABS_VOICE_ID ||
      !process.env.ELEVENLABS_MODEL_ID
    ) {
      throw new Error('Missing ElevenLabs environment variables');
    }
    return {
      vendor: TTSVendor.ElevenLabs,
      params: {
        api_key: process.env.ELEVENLABS_API_KEY,
        model_id: process.env.ELEVENLABS_MODEL_ID,
        voice_id: process.env.ELEVENLABS_VOICE_ID,
      },
    };
  }

  throw new Error(`Unsupported TTS vendor: ${vendor}`);
}

export default router;
