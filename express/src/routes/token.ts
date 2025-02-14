import express, { Request, Response, NextFunction } from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

const router = express.Router();

// Interface for validated and parsed request parameters
interface ValidatedParams {
  uid: number;
  channel: string;
}

// Extended Request interface to include validated parameters
interface RequestWithValidatedParams extends Request {
  validatedParams?: ValidatedParams;
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
router.get(
  '/',
  validateEnvironment as express.RequestHandler,
  validateRequest as express.RequestHandler,
  (req: Request, res: Response) => {
    console.log('Generating Agora token...');

    const { uid: uidStr, channel } = req.query;
    const uid = parseInt((uidStr as string) || '0');
    const channelName = (channel as string) || generateChannelName();
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
      res.json({
        token,
        uid: uid.toString(),
        channel: channelName,
      });
    } catch (error) {
      console.error('Error generating Agora token:', error);
      res.status(500).json({
        error: 'Failed to generate Agora token',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

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

/**
 * Middleware to verify required Agora credentials are present in environment
 * Checks for AGORA_APP_ID and AGORA_APP_CERTIFICATE
 * Returns 500 error if credentials are missing
 */
function validateEnvironment(req: Request, res: Response, next: NextFunction) {
  if (!process.env.AGORA_APP_ID || !process.env.AGORA_APP_CERTIFICATE) {
    console.error('Agora credentials are not set');
    return res.status(500).json({ error: 'Agora credentials are not set' });
  }
  next();
}

/**
 * Middleware to validate and sanitize request parameters
 * Validates:
 * - uid: Must be a valid number if provided
 * - channel: Must be 1-64 characters long, alphanumeric with hyphens only
 *
 * Stores validated parameters in req.validatedParams for use in route handler
 * @param {RequestWithValidatedParams} req - Extended request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next middleware function
 */
function validateRequest(
  req: RequestWithValidatedParams,
  res: Response,
  next: NextFunction
) {
  const { uid: uidStr, channel } = req.query;

  // Validate UID if provided
  if (uidStr && !/^\d+$/.test(uidStr as string)) {
    return res
      .status(400)
      .json({ error: 'Invalid uid parameter. Must be a number' });
  }

  // Validate channel name if provided
  if (channel) {
    if (typeof channel !== 'string') {
      return res
        .status(400)
        .json({ error: 'Invalid channel parameter. Must be a string' });
    }
    if (channel.length < 1 || channel.length > 64) {
      return res.status(400).json({
        error:
          'Invalid channel parameter. Length must be between 1 and 64 characters',
      });
    }
    // Only allow alphanumeric characters and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(channel)) {
      return res.status(400).json({
        error:
          'Invalid channel parameter. Only alphanumeric characters and hyphens are allowed',
      });
    }
  }

  // Parse and attach validated parameters to request object
  req.validatedParams = {
    uid: parseInt((uidStr as string) || '0'),
    channel: (channel as string) || generateChannelName(),
  };

  next();
}

export { router as tokenRouter };
