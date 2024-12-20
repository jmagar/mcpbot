import { ai, MODELS, ModelKey, getCurrentModel, validateTools, SYSTEM_PROMPT, MCP_TOOLS, toolSchemas, type ToolSchemas } from '../core/ai.js';
import type { ModelReference } from '@genkit-ai/ai';
import { z, type ZodObject, type ZodRawShape } from 'zod';

interface Tool {
  name: string;
  description: string;
  schema?: {
    input: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface ChatOptions {
  model: string | ModelReference<ZodObject<any>>;
  tools?: Tool[];
  system?: string;
}

interface McpTool {
  name: string;
  description: string;
  schema?: {
    input: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
  available: boolean;
}

interface Chat {
  send(message: string): Promise<{ text: string }>;
}

// Custom error classes for better error handling
class McpError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'McpError';
  }
}

class ChatSessionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ChatSessionError';
  }
}

class ToolConfigurationError extends Error {
  constructor(
    message: string, 
    public readonly toolName: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ToolConfigurationError';
  }
}

// Chat session class to manage individual chat sessions
export class ChatSession {
  private chat: Promise<Chat>;
  private currentModel: ModelKey;
  public lastAccess: number;

  constructor(modelKey: ModelKey = 'gemini') {
    if (!MODELS[modelKey]) {
      throw new ChatSessionError(`Model ${modelKey} is not available. Please check your API keys.`);
    }
    this.currentModel = modelKey;
    this.chat = this.createChat(modelKey);
    this.lastAccess = Date.now();
  }

  private async createChat(modelKey: ModelKey) {
    try {
      // Get available MCP tools
      const tools = await validateTools() as McpTool[];
      const availableTools = tools.filter(t => t.available);
      
      if (availableTools.length === 0) {
        console.warn('Warning: No MCP tools available for chat session');
      }

      const model = MODELS[modelKey];
      if (!model) {
        throw new ChatSessionError(`Model ${modelKey} is not available`);
      }

      try {
        // Log available tools for debugging
        console.log('Processing available tools:', availableTools.map(t => ({
          name: t.name,
          hasSchema: !!t.schema
        })));

        const tools = availableTools
          .map(tool => {
            const toolDef = Object.values(MCP_TOOLS)
              .flatMap(category => Object.values(category))
              .find(t => t.name === tool.name);
            
            if (!toolDef?.schema) {
              throw new ToolConfigurationError(
                `No schema found for tool: ${tool.name}`,
                tool.name,
                { availableSchema: !!tool.schema }
              );
            }

            // Log tool schema for debugging
            console.log(`Processing tool ${tool.name}:`, {
              schema: toolDef.schema,
              properties: toolDef.schema.input.properties
            });

            // Find matching Zod schema
            const category = Object.entries(toolSchemas).find(([_, schemas]) => 
              Object.keys(schemas).includes(tool.name)
            )?.[0];

            if (!category) {
              console.warn(`No Zod schema found for tool: ${tool.name}`);
              return undefined;
            }

            const zodSchema = toolSchemas[category as keyof ToolSchemas][tool.name as keyof ToolSchemas[keyof ToolSchemas]];

            const toolConfig: Tool = {
              name: tool.name,
              description: tool.description,
              schema: {
                input: {
                  type: 'object',
                  properties: Object.fromEntries(
                    Object.entries(zodSchema.input.shape as ZodRawShape).map(([key, value]) => [
                      key,
                      { type: 'string', description: (value as any)._def.description || '' }
                    ])
                  ),
                  required: Object.keys(zodSchema.input.shape as ZodRawShape)
                }
              }
            };

            return toolConfig;
          })
          .filter((t): t is Tool => t !== undefined);

        // Log final tool configurations
        console.log('Final tool configurations:', tools.map(t => ({
          name: t.name,
          schema: t.schema
        })));

        const options: ChatOptions = {
          model,
          tools,
          system: SYSTEM_PROMPT,
        };

        return ai.chat(options);
      } catch (error) {
        console.error('Error configuring chat tools:', error);
        if (error instanceof Error) {
          console.error('Tool configuration error details:', {
            message: error.message,
            stack: error.stack,
            tools: availableTools.map(t => t.name)
          });
        }
        if (error instanceof ToolConfigurationError) {
          throw error;
        }
        throw new ChatSessionError(
          `Failed to configure chat tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error : undefined
        );
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      throw new ChatSessionError(
        'Failed to initialize chat session. Please check your configuration.',
        error instanceof Error ? error : undefined
      );
    }
  }

  public switchModel(modelKey: ModelKey): boolean {
    if (!MODELS[modelKey]) {
      return false;
    }
    try {
      this.currentModel = modelKey;
      this.chat = this.createChat(modelKey);
      this.lastAccess = Date.now();
      return true;
    } catch (error) {
      console.error('Error switching model:', error);
      return false;
    }
  }

  public getCurrentModelName(): string {
    return getCurrentModel(this.currentModel);
  }

  public async sendMessage(message: string): Promise<string> {
    try {
      const chat = await this.chat;
      const response = await chat.send(message);
      this.lastAccess = Date.now();
      return response.text;
    } catch (error) {
      console.error('Error in chat:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error
      });
      
      // Handle specific error types
      if (error instanceof ToolConfigurationError) {
        throw new McpError(`Tool configuration error: ${error.message}`, {
          toolName: error.toolName,
          details: error.details
        });
      }

      if (error instanceof ChatSessionError) {
        throw new McpError(`Chat session error: ${error.message}`, {
          cause: error.cause?.message
        });
      }

      if (error instanceof Error) {
        // Handle specific MCP error messages
        if (error.message.includes('MCP connection failed')) {
          throw new McpError('Failed to connect to MCP server. Please check if the server is running.', {
            originalError: error.message,
            stack: error.stack
          });
        }
        if (error.message.includes('MCP tool execution failed')) {
          throw new McpError('Failed to execute MCP tool. Please verify tool configuration.', {
            originalError: error.message,
            stack: error.stack
          });
        }
        if (error.message.includes('MCP tool not found')) {
          throw new McpError('Requested MCP tool is not available. Please check tool configuration.', {
            originalError: error.message,
            stack: error.stack
          });
        }
        if (error.message.includes('MCP')) {
          throw new McpError('An MCP-related error occurred. Please check server logs for details.', {
            originalError: error.message,
            stack: error.stack
          });
        }

        // Handle unknown errors
        throw new McpError('Failed to process message. Please try again or contact support.', {
          originalError: error.message,
          stack: error.stack,
          type: error.constructor.name
        });
      }

      // Handle non-Error objects
      throw new McpError('An unknown error occurred', {
        error: String(error),
        type: typeof error
      });
    }
  }

  // Method to validate session health
  public async validateSession(): Promise<boolean> {
    try {
      const tools = validateTools();
      return tools.some(t => t.available);
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  }
}

// Export error classes for use in other files
export { McpError, ChatSessionError, ToolConfigurationError };
