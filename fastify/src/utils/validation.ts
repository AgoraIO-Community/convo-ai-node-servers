import { FastifyRequest, FastifyReply } from 'fastify';
import {
  InviteAgentRequest,
  RemoveAgentRequest,
} from '../types/client-request-types';

/**
 * Middleware to validate required environment variables based on the route.
 * Checks for:
 * - Agora credentials (all routes)
 * - Agora Conversation AI credentials (agent routes)
 * - LLM configuration (agent routes)
 * - TTS vendor-specific configuration (agent routes)
 */
export async function validateEnvironment(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Common Agora credentials
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return reply.code(500).send({ error: 'Agora credentials are not set' });
  }

  // Validate based on route
  if (request.url.startsWith('/agent')) {
    // Additional validations for agent routes
    if (
      !process.env.AGORA_CONVO_AI_BASE_URL ||
      !process.env.AGORA_CUSTOMER_ID ||
      !process.env.AGORA_CUSTOMER_SECRET
    ) {
      console.error('Agora Conversation AI credentials are not set');
      return reply.code(500).send({
        error: 'Agora Conversation AI credentials are not set',
      });
    }

    // LLM validations
    if (!process.env.LLM_URL || !process.env.LLM_TOKEN) {
      console.error('LLM configuration is not set');
      return reply.code(500).send({ error: 'LLM configuration is not set' });
    }

    // TTS validations
    const ttsVendor = process.env.TTS_VENDOR;
    if (!ttsVendor) {
      console.error('TTS_VENDOR is not set');
      return reply.code(500).send({ error: 'TTS_VENDOR is not set' });
    }

    if (ttsVendor === 'microsoft') {
      if (
        !process.env.MICROSOFT_TTS_KEY ||
        !process.env.MICROSOFT_TTS_REGION ||
        !process.env.MICROSOFT_TTS_VOICE_NAME ||
        !process.env.MICROSOFT_TTS_RATE ||
        !process.env.MICROSOFT_TTS_VOLUME
      ) {
        console.error('Microsoft TTS configuration is not set');
        return reply.code(500).send({
          error: 'Microsoft TTS configuration is not set',
        });
      }
    } else if (ttsVendor === 'elevenlabs') {
      if (
        !process.env.ELEVENLABS_API_KEY ||
        !process.env.ELEVENLABS_VOICE_ID ||
        !process.env.ELEVENLABS_MODEL_ID
      ) {
        console.error('ElevenLabs TTS configuration is not set');
        return reply.code(500).send({
          error: 'ElevenLabs TTS configuration is not set',
        });
      }
    } else {
      return reply.code(500).send({
        error: `Unsupported TTS vendor: ${ttsVendor}`,
      });
    }
  }
}

/**
 * Middleware to ensure incoming POST requests have the correct Content-Type header.
 * Rejects requests that don't specify 'application/json' with a 415 status code.
 */
export async function validateContentType(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (
    request.method === 'POST' &&
    request.headers['content-type'] !== 'application/json'
  ) {
    return reply.code(415).send({
      error: 'Unsupported Media Type. Content-Type must be application/json',
    });
  }
}

/**
 * Middleware to validate POST request bodies based on the route.
 * Performs specific validations for:
 * - /agent/invite: Validates requester_id (alphanumeric string or positive integer)
 *                 and channel_name (3-64 character string)
 * - /agent/remove: Validates agent_id (string)
 */
export async function validateRequestBody(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Skip validation for non-POST requests
  if (request.method !== 'POST') {
    return;
  }

  // Validate request body
  const body = request.body as any;
  if (!body || Object.keys(body).length === 0) {
    return reply.code(400).send({ error: 'Request body is required' });
  }

  // Route-specific validation
  if (request.url === '/agent/invite') {
    const { requester_id, channel_name } = body as InviteAgentRequest;

    if (!requester_id) {
      return reply.code(400).send({ error: 'requester_id is required' });
    }

    if (!channel_name) {
      return reply.code(400).send({ error: 'channel_name is required' });
    }

    // Validate requester_id format
    if (typeof requester_id === 'string') {
      if (!/^[a-zA-Z0-9-]+$/.test(requester_id)) {
        return reply.code(400).send({
          error:
            'requester_id must contain only alphanumeric characters and hyphens',
        });
      }
    } else if (typeof requester_id === 'number') {
      if (!Number.isInteger(requester_id) || requester_id < 0) {
        return reply.code(400).send({
          error:
            'requester_id must be a positive integer when provided as a number',
        });
      }
    } else {
      return reply.code(400).send({
        error: 'requester_id must be a string or number',
      });
    }

    // Validate channel_name format and length constraints
    if (typeof channel_name !== 'string') {
      return reply.code(400).send({
        error: 'channel_name must be a string',
      });
    }

    if (channel_name.length < 3 || channel_name.length > 64) {
      return reply.code(400).send({
        error: 'channel_name length must be between 3 and 64 characters',
      });
    }
  } else if (request.url === '/agent/remove') {
    const { agent_id } = body as RemoveAgentRequest;

    if (!agent_id) {
      return reply.code(400).send({ error: 'agent_id is required' });
    }

    if (typeof agent_id !== 'string') {
      return reply.code(400).send({ error: 'agent_id must be a string' });
    }
  }
}
