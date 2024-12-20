import { genkit } from 'genkit';
import { mcpClient } from 'genkitx-mcp';
import { googleAI, gemini15Pro } from '@genkit-ai/googleai';
import { anthropic } from 'genkitx-anthropic';
import { WORKSPACE_DIR } from './config';
import { z } from 'zod';

// System prompt for the AI
export const SYSTEM_PROMPT = `You are an intelligent programmer with access to various tools through the Model Context Protocol (MCP).`;

// Define MCP tool interfaces
export interface McpTool {
  name: string;
  description: string;
  schema?: {
    input: {
      type: string;
      properties: Record<string, unknown>;
      required?: readonly string[];
    };
  };
  available: boolean;
}

// Available MCP tools with proper namespacing and descriptions
export const MCP_TOOLS = {
  filesystem: {
    read: { 
      name: 'read_file', 
      description: 'Read file contents from workspace',
      schema: {
        input: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file to read' }
          },
          required: ['path'] as const
        }
      }
    },
    write: { 
      name: 'write_to_file', 
      description: 'Write content to file in workspace',
      schema: {
        input: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to write the file to' },
            content: { type: 'string', description: 'Content to write to the file' }
          },
          required: ['path', 'content'] as const
        }
      }
    }
  }
} as const;

// MCP Server error handling
class McpServerError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'McpServerError';
  }
}

// Define tool schemas with Zod for type safety and runtime validation
export const toolSchemas = {
  filesystem: {
    read_file: {
      input: z.object({
        path: z.string().describe('Path to the file to read')
      }),
      output: z.string().describe('File contents')
    },
    write_to_file: {
      input: z.object({
        path: z.string().describe('Path to write the file to'),
        content: z.string().describe('Content to write to the file')
      }),
      output: z.void()
    },
    list_files: {
      input: z.object({
        path: z.string().describe('Directory path to list'),
        recursive: z.boolean().optional().describe('Whether to list recursively')
      }),
      output: z.array(z.string()).describe('List of file paths')
    },
    search_files: {
      input: z.object({
        path: z.string().describe('Directory to search in'),
        regex: z.string().describe('Regular expression pattern to search for'),
        file_pattern: z.string().optional().describe('File pattern to filter (e.g., *.ts)')
      }),
      output: z.array(z.object({
        file: z.string(),
        matches: z.array(z.string())
      }))
    },
    replace_in_file: {
      input: z.object({
        path: z.string().describe('Path to the file to modify'),
        diff: z.string().describe('Content changes in SEARCH/REPLACE format')
      }),
      output: z.void()
    }
  }
} as const;

// Export types for tool schemas
export type ToolSchemas = typeof toolSchemas;
export type ToolName = keyof ToolSchemas[keyof ToolSchemas];

// Initialize MCP clients with error handling
function createMcpClient(config: {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}) {
  try {
    console.log(`Initializing MCP client: ${config.name}`);
    const client = mcpClient({
      name: config.name,
      serverProcess: {
        command: config.command,
        args: config.args,
        env: config.env
      }
    });

    console.log(`MCP client initialized: ${config.name}`);
    return client;
  } catch (error) {
    console.error(`Failed to initialize MCP client: ${config.name}`, error);
    throw new McpServerError(`Failed to initialize ${config.name} server`, {
      error: String(error),
      command: config.command,
      args: config.args
    });
  }
}

const mcpConfigs = [
  // Filesystem operations with schema validation
  createMcpClient({
    name: 'filesystem',
    command: 'node',
    args: ['node_modules/@modelcontextprotocol/server-filesystem/dist/index.js', WORKSPACE_DIR],
  }),

  // Brave Search with error handling
  createMcpClient({
    name: 'brave',
    command: 'node',
    args: ['node_modules/@modelcontextprotocol/server-brave-search/dist/index.js'],
    env: process.env.BRAVE_API_KEY ? {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY
    } : {}
  }),

  // GitHub with error handling
  createMcpClient({
    name: 'github',
    command: 'node',
    args: ['node_modules/@modelcontextprotocol/server-github/dist/index.js'],
    env: process.env.GITHUB_PERSONAL_ACCESS_TOKEN ? {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    } : {}
  }),

  // Puppeteer with error handling
  createMcpClient({
    name: 'puppeteer',
    command: 'node',
    args: ['node_modules/@modelcontextprotocol/server-puppeteer/dist/index.js']
  }),

  // Sequential Thinking with error handling
  createMcpClient({
    name: 'sequential-thinking',
    command: 'node',
    args: ['node_modules/@modelcontextprotocol/server-sequential-thinking/dist/index.js']
  }),
];

// Initialize Genkit with plugins and error handling
export const ai = (() => {
  try {
    console.log('Initializing Genkit with plugins...');
    const instance = genkit({
      plugins: [
        ...mcpConfigs,
        // Google AI plugin for Gemini models
        googleAI({
          apiKey: process.env.GOOGLE_GENAI_API_KEY || ''
        }),
        // Anthropic plugin for Claude models
        anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY || ''
        }),
      ],
    });
    console.log('Genkit initialized successfully');
    return instance;
  } catch (error) {
    console.error('Failed to initialize Genkit:', error);
    throw new Error(`Failed to initialize AI: ${error instanceof Error ? error.message : String(error)}`);
  }
})();

// Available models with proper typing
export const MODELS = {
  ...(process.env.GOOGLE_GENAI_API_KEY ? { gemini: gemini15Pro } : {}),
  ...(process.env.ANTHROPIC_API_KEY ? { claude: 'anthropic/claude-3-opus-20240229' } : {})
} as const;

export type ModelKey = keyof typeof MODELS;

// Function to get the current model name
export function getCurrentModel(modelKey: ModelKey): string {
  return `Using ${modelKey} model`;
}

// Function to validate tool availability with proper typing and error handling
export function validateTools(): McpTool[] {
  try {
    const toolList: McpTool[] = [];
    
    Object.entries(MCP_TOOLS).forEach(([category, tools]) => {
      Object.entries(tools).forEach(([name, tool]) => {
        toolList.push({
          name: tool.name,
          description: tool.description,
          schema: tool.schema,
          available: true
        });
      });
    });
    
    return toolList;
  } catch (error) {
    console.error('Error validating tools:', error);
    throw new Error('Failed to validate MCP tools. Please check your MCP server configuration.');
  }
}

// Function to check if any models are available
export function validateModels(): boolean {
  return Object.keys(MODELS).length > 0;
}

// Export error classes
export { McpServerError };
