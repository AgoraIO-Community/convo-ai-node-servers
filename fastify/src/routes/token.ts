import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Interface for request parameters
interface TokenQuerystring {
  uid?: string;
  channel?: string;
}

/**
 * GET /token - Generate Agora RTC PUBLISHER token for client
 * Query Parameters:
 * - uid (optional): Unique user identifier
 * - channel (optional): Channel name for the communication
 * Returns:
 * - token: Generated Agora token
 * - uid: User identifier used for token generation
 * - channel: Channel name used for token generation
 */
export async function tokenRoutes(fastify: FastifyInstance) {
  // Define the schema for request validation
  const schema = {
    querystring: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          pattern: '^d+$',
          description: 'Must be a valid number',
        },
        channel: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-]{1,64}$',
          description:
            'Must be 1-64 characters long, alphanumeric with hyphens only',
        },
      },
    },
  };

  // Verify environment variables before registering routes
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    throw new Error('Agora credentials are not set');
  }

  fastify.get<{
    Querystring: TokenQuerystring;
  }>('/', {
    schema,
    handler: async (request, reply) => {
      console.log('Generating Agora token...');

      const { uid: uidStr, channel } = request.query;
      const uid = parseInt(uidStr || '0');
      const channelName = channel || generateChannelName();
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;

      try {
        console.log('Building token with UID:', uid, 'Channel:', channelName);
        const token = RtcTokenBuilder.buildTokenWithUid(
          process.env.AGORA_APP_ID!,
          process.env.AGORA_APP_CERTIFICATE!,
          channelName,
          uid,
          RtcRole.PUBLISHER,
          expirationTime,
          expirationTime
        );

        console.log('Token generated successfully');
        return {
          token,
          uid: uid.toString(),
          channel: channelName,
        };
      } catch (error) {
        console.error('Error generating Agora token:', error);
        reply.code(500).send({
          error: 'Failed to generate Agora token',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });
}

/**
 * Generates a unique channel name using timestamp and random string
 * Format: 'ai-conversation-{timestamp}-{random}'
 * @returns {string} Generated channel name
 */
function generateChannelName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `ai-conversation-${timestamp}-${random}`;
}
