import { genkit } from 'genkit';
import { mcpClient } from 'genkitx-mcp';
import { googleAI, gemini15Pro } from '@genkit-ai/googleai';
import { anthropic } from 'genkitx-anthropic';

// Get the absolute path to the workspace
const WORKSPACE_DIR = process.cwd();

if (!process.env.BRAVE_API_KEY) {
  throw new Error('BRAVE_API_KEY environment variable is required');
}

// Initialize Genkit with all our plugins
export const ai = genkit({
  plugins: [
    // MCP plugin for filesystem access
    mcpClient({
      name: 'filesystem',
      serverProcess: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything', WORKSPACE_DIR],
      },
    }),
    // MCP plugin for Brave Search
    mcpClient({
      name: 'brave',
      serverProcess: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: process.env.BRAVE_API_KEY,
        },
      },
    }),
    // Google AI plugin for Gemini models
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
    // Anthropic plugin for Claude models
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  ],
});

// Available models
export const MODELS = {
  gemini: gemini15Pro,
  claude: 'anthropic/claude-3-opus-20240229',
} as const;

export type ModelKey = keyof typeof MODELS;

// Function to get the current model name
export function getCurrentModel(modelKey: ModelKey): string {
  return `Using ${modelKey} model`;
}

// Chat session class to manage individual chat sessions
export class ChatSession {
  private chat;
  private currentModel: ModelKey;

  constructor(modelKey: ModelKey = 'gemini') {
    this.currentModel = modelKey;
    this.chat = this.createChat(modelKey);
  }

  private createChat(modelKey: ModelKey) {
    return ai.chat({
      model: MODELS[modelKey],
      system: `You are a helpful AI assistant with access to both filesystem operations and web search capabilities through MCP.
      
      For filesystem operations:
      - You can help users with file operations and answer questions
      - Always be clear about what files you're accessing or operations you're performing
      - You have access to files in: ${WORKSPACE_DIR}
      
      For web search:
      - You can search the web using Brave Search to find current information
      - Use search when you need to answer questions about current events or verify facts
      - Always cite your sources when providing information from web searches`,
    });
  }

  public switchModel(modelKey: ModelKey): boolean {
    if (MODELS[modelKey]) {
      this.currentModel = modelKey;
      this.chat = this.createChat(modelKey);
      return true;
    }
    return false;
  }

  public getCurrentModelName(): string {
    return getCurrentModel(this.currentModel);
  }

  public async sendMessage(message: string): Promise<string> {
    try {
      const response = await this.chat.send(message);
      return response.text;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }
} 