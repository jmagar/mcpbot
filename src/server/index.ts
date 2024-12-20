import 'dotenv/config';
import express, { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { MODELS, ModelKey, validateModels, validateTools } from '../core/ai.js';
import { ChatSession } from './chat.js';
import { WORKSPACE_DIR } from '../core/config.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(WORKSPACE_DIR, 'src/client')));

// Store chat sessions
const sessions: Map<string, ChatSession> = new Map();

// Define route parameter types
interface ChatParams {
  sessionId: string;
}

interface MessageBody {
  message: string;
}

interface ModelBody {
  model: string;
}

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  console.error('Error:', err);
  
  if (err.name === 'McpError') {
    res.status(503).json({ 
      error: err.message,
      type: 'mcp_error',
      details: 'MCP server connection or tool execution error'
    });
    return;
  }

  // Handle MCP initialization errors
  if (err.message?.includes('MCP')) {
    res.status(503).json({
      error: 'MCP server error',
      type: 'mcp_init_error',
      details: err.message
    });
    return;
  }
  
  if (err instanceof SyntaxError) {
    res.status(400).json({ 
      error: 'Invalid request format',
      type: 'syntax_error'
    });
    return;
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    type: 'server_error'
  });
};

// Session cleanup
const cleanupInactiveSessions = () => {
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  
  sessions.forEach((session, id) => {
    if (now - session.lastAccess > maxAge) {
      sessions.delete(id);
    }
  });
};

// Start session cleanup interval
setInterval(cleanupInactiveSessions, 5 * 60 * 1000); // Run every 5 minutes

// Middleware to validate session
const validateSession = async (
  req: Request<ChatParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  
  try {
    const isValid = await session.validateSession();
    if (!isValid) {
      sessions.delete(sessionId);
      res.status(503).json({ error: 'Session is no longer valid' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Routes
app.get('/api/models', ((_: Request, res: Response): void => {
  if (!validateModels()) {
    res.status(503).json({ error: 'No models available. Please check API keys.' });
    return;
  }
  res.json(Object.keys(MODELS));
}));

app.post('/api/chat/start', ((req: Request<Record<string, never>, unknown, ModelBody>, res: Response): void => {
  const sessionId = Math.random().toString(36).substring(7);
  const modelKey = (req.body.model || 'gemini') as ModelKey;
  
  try {
    const session = new ChatSession(modelKey);
    sessions.set(sessionId, session);
    
    res.json({
      sessionId,
      model: session.getCurrentModelName(),
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(503).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to start chat session' });
    }
  }
}));

app.post('/api/chat/:sessionId/message', 
  validateSession,
  async (req: Request<ChatParams, unknown, MessageBody>, res: Response, next: NextFunction): Promise<void> => {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    try {
      const response = await session.sendMessage(message);
      res.json({ response });
    } catch (error) {
      next(error);
    }
  }
);

app.post('/api/chat/:sessionId/switch',
  validateSession,
  (req: Request<ChatParams, unknown, ModelBody>, res: Response): void => {
    const { sessionId } = req.params;
    const { model } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    if (session.switchModel(model as ModelKey)) {
      res.json({ model: session.getCurrentModelName() });
    } else {
      res.status(400).json({ error: 'Invalid model' });
    }
  }
);

// Add error handling middleware
app.use(errorHandler);

// Start server
// Add MCP tools endpoint
app.get('/api/tools', ((req: Request, res: Response) => {
  try {
    const tools = validateTools();
    res.json(tools);
  } catch (error) {
    console.error('Error getting tools:', error);
    res.status(500).json({ error: 'Failed to get tools' });
  }
}) as RequestHandler);

app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // Initialize MCP servers
  try {
    const tools = await validateTools();
    const availableTools = tools.filter(t => t.available);
    console.log('Available MCP tools:', availableTools.map(t => t.name));
    
    if (availableTools.length === 0) {
      console.warn('Warning: No MCP tools available');
    }
  } catch (error) {
    console.error('Error initializing MCP servers:', error);
  }
  
  // Log available models
  const models = Object.keys(MODELS);
  if (models.length === 0) {
    console.warn('Warning: No models available. Please check your API keys.');
  } else {
    console.log('Available models:', models);
  }
});
