import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

// Import route handlers and middleware
import { tokenRoutes } from './routes/token';
import { agentRoutes } from './routes/agent';
import {
  validateEnvironment,
  validateContentType,
  validateRequestBody,
} from './utils/validation';

// Load environment variables from .env file
dotenv.config();

// Initialize Fastify application
const fastify = Fastify({
  logger: true,
});

// Setup and start server
const start = async () => {
  try {
    // Register plugins
    await fastify.register(cors);

    // Register global hooks
    // Configure validation middleware for all routes
    fastify.addHook('preHandler', validateEnvironment);
    fastify.addHook('preHandler', validateContentType);
    fastify.addHook('preHandler', validateRequestBody);

    // Register route handlers
    fastify.register(tokenRoutes, { prefix: '/token' });
    fastify.register(agentRoutes, { prefix: '/agent' });

    fastify.get('/ping', async (request, reply) => {
      return { message: 'pong' };
    });

    // Start the server
    await fastify.listen({
      port: Number(process.env.PORT) || 3030,
      host: '0.0.0.0', // Listen on all interfaces
    });

    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
