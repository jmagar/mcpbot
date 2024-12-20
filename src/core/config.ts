// Get the absolute path to the workspace
export const WORKSPACE_DIR = process.cwd();

// Optional environment variables with validation warnings
const requiredEnvVars = {
  BRAVE_API_KEY: 'Brave Search functionality will be disabled',
  GOOGLE_GENAI_API_KEY: 'Gemini model will be unavailable',
  ANTHROPIC_API_KEY: 'Claude model will be unavailable',
  GITHUB_PERSONAL_ACCESS_TOKEN: 'GitHub functionality will be disabled'
} as const;

// Check environment variables and log warnings for missing ones
Object.entries(requiredEnvVars).forEach(([key, message]) => {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set - ${message}`);
  }
});

// Validate that at least one model API key is available
if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  throw new Error('At least one model API key (GOOGLE_GENAI_API_KEY or ANTHROPIC_API_KEY) is required');
}

// Export environment variables with proper typing
export const env = {
  BRAVE_API_KEY: process.env.BRAVE_API_KEY,
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
} as const;
