import { z } from "zod/v4";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b"),
  LLM_PROVIDER: z.enum(["gemini", "openai", "ollama", "none"]).default("none"),
  LLM_FALLBACK: z.enum(["gemini", "openai", "ollama", "none"]).default("none"),
  UPLOAD_DIR: z.string().default("./uploads"),
  CORS_ORIGIN: z.string().default("*"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  RATE_LIMIT_MAX_REQUESTS: z.string().default("100"),
  /** "log" captures email in the outbox table; real transports plug in here. */
  EMAIL_PROVIDER: z.enum(["log"]).default("log"),
  /** "postgres" shares counters across processes and survives restarts. */
  RATE_LIMIT_STORE: z.enum(["postgres", "memory"]).default("postgres"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path}: ${issue.message}`);
    }
    process.exit(1);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}
