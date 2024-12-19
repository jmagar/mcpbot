// Get the absolute path to the workspace
export const WORKSPACE_DIR = process.cwd();

// Validate required environment variables
if (!process.env.BRAVE_API_KEY) {
  throw new Error('BRAVE_API_KEY environment variable is required');
}

if (!process.env.GOOGLE_GENAI_API_KEY) {
  throw new Error('GOOGLE_GENAI_API_KEY environment variable is required');
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}
