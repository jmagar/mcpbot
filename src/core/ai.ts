import { genkit } from 'genkit';
import { mcpClient } from 'genkitx-mcp';
import { googleAI, gemini15Pro } from '@genkit-ai/googleai';
import { anthropic } from 'genkitx-anthropic';
import { WORKSPACE_DIR } from './config';

// Initialize MCP clients once for the entire application
const mcpPlugins = [
  // MCP plugin for filesystem and other operations
  mcpClient({
    name: 'filesystem',
    version: '1.0.0',
    serverProcess: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything', WORKSPACE_DIR],
    },
  }),
  // MCP plugin for Brave Search
  mcpClient({
    name: 'brave',
    version: '1.0.0',
    serverProcess: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY as string,
      },
    },
  }),
];

// Initialize Genkit with our plugins
export const ai = genkit({
  plugins: [
    ...mcpPlugins,
    // Google AI plugin for Gemini models
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY as string,
    }),
    // Anthropic plugin for Claude models
    anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY as string,
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
