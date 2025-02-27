import express, { Request, Response, NextFunction } from 'express';
import type { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import route handlers and middleware
import { tokenRouter } from './routes/token';
import { agentRouter } from './routes/agent';
import {
  validateEnvironment,
  validateContentType,
  validateRequestBody,
} from './utils/validation';

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app: Application = express();
const port = process.env.PORT || 3000;

// Configure global middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing (CORS)
app.use(express.json()); // Parse incoming JSON payloads

// Create a new router instance for better route organization
const router = express.Router();

// Configure validation middleware for all routes
// Ensure required environment variables are set
router.use(validateEnvironment as express.RequestHandler); // Ensure required environment variables are set
router.use(validateContentType as express.RequestHandler); // Verify correct Content-Type header
router.use(validateRequestBody as express.RequestHandler); // Validate request body structure

// Register route handlers
router.use('/token', tokenRouter); // Handle token authentication endpoint
router.use('/agent', agentRouter); // Handle agent endpoints

router.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

// Mount the router
app.use('/', router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
