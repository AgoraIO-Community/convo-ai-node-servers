import { Request, Response, NextFunction } from 'express';
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
export function validateEnvironment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Common Agora credentials
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return res.status(500).json({ error: 'Agora credentials are not set' });
  }

  // Validate based on route
  if (req.path.startsWith('/agent')) {
    // Additional validations for agent routes
    if (
      !process.env.AGORA_CONVO_AI_BASE_URL ||
      !process.env.AGORA_CUSTOMER_ID ||
      !process.env.AGORA_CUSTOMER_SECRET
    ) {
      console.error('Agora Conversation AI credentials are not set');
      return res.status(500).json({
        error: 'Agora Conversation AI credentials are not set',
      });
    }

    // LLM validations
    if (!process.env.LLM_URL || !process.env.LLM_TOKEN) {
      console.error('LLM configuration is not set');
      return res.status(500).json({ error: 'LLM configuration is not set' });
    }

    // TTS validations
    const ttsVendor = process.env.TTS_VENDOR;
    if (!ttsVendor) {
      console.error('TTS_VENDOR is not set');
      return res.status(500).json({ error: 'TTS_VENDOR is not set' });
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
        return res.status(500).json({
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
        return res.status(500).json({
          error: 'ElevenLabs TTS configuration is not set',
        });
      }
    } else {
      return res.status(500).json({
        error: `Unsupported TTS vendor: ${ttsVendor}`,
      });
    }
  }

  next();
}

/**
 * Middleware to ensure incoming POST requests have the correct Content-Type header.
 * Rejects requests that don't specify 'application/json' with a 415 status code.
 */
export function validateContentType(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({
      error: 'Unsupported Media Type. Content-Type must be application/json',
    });
  }
  next();
}

/**
 * Middleware to validate POST request bodies based on the route.
 * Performs specific validations for:
 * - /agent/invite: Validates requester_id (alphanumeric string or positive integer)
 *                 and channel_name (3-64 character string)
 * - /agent/remove: Validates agent_id (string)
 */
export function validateRequestBody(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip validation for non-POST requests
  if (req.method !== 'POST') {
    return next();
  }

  // Ensure request body is not empty
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  // Route-specific validation
  if (req.path === '/agent/invite') {
    const { requester_id, channel_name } = req.body as InviteAgentRequest;

    if (!requester_id) {
      return res.status(400).json({ error: 'requester_id is required' });
    }

    if (!channel_name) {
      return res.status(400).json({ error: 'channel_name is required' });
    }

    // Validate requester_id format
    if (typeof requester_id === 'string') {
      if (requester_id.trim() === '') {
        return res.status(400).json({
          error: 'requester_id cannot be empty',
        });
      }
    } else if (typeof requester_id === 'number') {
      if (!Number.isInteger(requester_id) || requester_id < 0) {
        return res.status(400).json({
          error:
            'requester_id must be a positive integer when provided as a number',
        });
      }
    } else {
      return res.status(400).json({
        error: 'requester_id must be a string or number',
      });
    }

    // Validate channel_name format and length constraints
    if (typeof channel_name !== 'string') {
      return res.status(400).json({
        error: 'channel_name must be a string',
      });
    }

    if (channel_name.length < 3 || channel_name.length > 64) {
      return res.status(400).json({
        error: 'channel_name length must be between 3 and 64 characters',
      });
    }
  } else if (req.path === '/agent/remove') {
    const { agent_id } = req.body as RemoveAgentRequest;

    if (!agent_id) {
      return res.status(400).json({ error: 'agent_id is required' });
    }

    if (typeof agent_id !== 'string') {
      return res.status(400).json({ error: 'agent_id must be a string' });
    }
  }

  next();
}
