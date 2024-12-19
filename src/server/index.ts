import 'dotenv/config';
import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { MODELS, ModelKey } from '../core/ai.js';
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

// Routes
app.get('/api/models', ((_: Request, res: Response) => {
  res.json(Object.keys(MODELS));
}) as RequestHandler);

app.post('/api/chat/start', ((req: Request<Record<string, never>, unknown, ModelBody>, res: Response) => {
  const sessionId = Math.random().toString(36).substring(7);
  const modelKey = (req.body.model || 'gemini') as ModelKey;
  
  const session = new ChatSession(modelKey);
  sessions.set(sessionId, session);
  
  res.json({
    sessionId,
    model: session.getCurrentModelName(),
  });
}) as RequestHandler<Record<string, never>, unknown, ModelBody>);

app.post('/api/chat/:sessionId/message', (async (req: Request<ChatParams, unknown, MessageBody>, res: Response) => {
  const { sessionId } = req.params;
  const { message } = req.body;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const response = await session.sendMessage(message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process message' });
  }
}) as RequestHandler<ChatParams, unknown, MessageBody>);

app.post('/api/chat/:sessionId/switch', ((req: Request<ChatParams, unknown, ModelBody>, res: Response) => {
  const { sessionId } = req.params;
  const { model } = req.body;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (session.switchModel(model as ModelKey)) {
    res.json({ model: session.getCurrentModelName() });
  } else {
    res.status(400).json({ error: 'Invalid model' });
  }
}) as RequestHandler<ChatParams, unknown, ModelBody>);

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
