import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { getConfig, isProduction } from "./config/env";
import { globalRateLimiter } from "./middleware/rate-limiter";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { sanitizeBody, sanitizeQuery } from "./middleware/sanitizer";
import router from "./routes";
import filesRouter from "./routes/files";
import { logger } from "./lib/logger";

const config = getConfig();

const app: Express = express();

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

// CORS configuration
const corsOrigins = config.CORS_ORIGIN === "*"
  ? true
  : config.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
}));

// Rate limiting
app.use(globalRateLimiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Input sanitization
app.use(sanitizeBody);
app.use(sanitizeQuery);

// Logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Health check (no auth required)
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root index — this port is the API only; the UI is served separately.
app.get("/", (_req, res) => {
  res.json({
    name: "HiMe AI Hiring Platform API",
    version: "1.0.0",
    docs: "See README.md for the full endpoint list.",
    ui: config.FRONTEND_URL || "http://localhost:3000",
    endpoints: {
      health: "/healthz",
      auth: "/api/auth",
      jobs: "/api/jobs",
      candidates: "/api/candidates",
      companies: "/api/companies",
      applications: "/api/applications",
      matching: "/api/ai",
      admin: "/api/admin",
    },
  });
});

// API routes
app.use("/api", router);

// Serve uploaded files only through the ownership-checked route.
// A bare express.static here would expose every CV to anyone with a URL.
app.use("/files", filesRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
