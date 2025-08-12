// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import compression from "compression";
import { body, validationResult } from "express-validator";

// Import our custom modules
import { query } from './config/database.js';
import { authenticateToken, optionalAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import usageRoutes from './routes/usage.js';
import webhookRoutes from './routes/webhooks.js';
import { initializeCronJobs } from './utils/cronJobs.js';
import logger from './utils/logger.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Security middleware (adjusted for Chrome extension)
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow Chrome extension to embed
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  }
}));

// CORS configuration for Chrome extension
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : [
          'http://localhost:3000', 
          'http://localhost:5173',
          'chrome-extension://*', // Allow all Chrome extensions
          'moz-extension://*'     // Allow Firefox extensions
        ];
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        return origin.startsWith(allowedOrigin.replace('*', ''));
      }
      return origin === allowedOrigin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Rate limiting (more permissive for Chrome extension)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // Increased limit for extension users
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks and webhooks
  skip: (req) => req.path === '/health' || req.path === '/' || req.path.startsWith('/api/webhooks'),
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ 
        status: "✅ AI Calendar Backend is running.",
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        service: "ai-calendar-backend",
        version: "1.0.0"
    });
});

// Health check for monitoring
app.get("/health", async (req, res) => {
    try {
        // Test database connection
        await query('SELECT 1');
        
        res.json({ 
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: "ai-calendar-backend",
            database: "connected"
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            service: "ai-calendar-backend",
            database: "disconnected"
        });
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/webhooks', webhookRoutes);

// Enhanced chat endpoint with usage tracking
const validateChatRequest = [
    body('messages').isArray().withMessage('Messages must be an array'),
    body('messages.*.role').isIn(['user', 'assistant', 'system']).withMessage('Invalid message role'),
    body('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('stream').optional().isBoolean().withMessage('Stream must be a boolean')
];

app.post("/api/chat", optionalAuth, validateChatRequest, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: "Validation failed", 
            details: errors.array() 
        });
    }

    const { messages, model = "gpt-4o-mini", stream = false } = req.body;
    const user = req.user; // Will be undefined if no auth token provided

    // If user is authenticated, check usage limits
    if (user) {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            // Get user's usage for current month
            const usageResult = await query(
                `SELECT ut.questions_used, ut.questions_limit, s.plan_type
                 FROM usage_tracking ut
                 LEFT JOIN subscriptions s ON ut.user_id = s.user_id AND s.status = 'active'
                 WHERE ut.user_id = $1 AND ut.month_year = $2`,
                [user.id, currentMonth]
            );

            if (usageResult.rows.length > 0) {
                const usage = usageResult.rows[0];
                
                if (usage.questions_used >= usage.questions_limit) {
                    return res.status(403).json({
                        error: {
                            code: 'USAGE_LIMIT_EXCEEDED',
                            message: 'You have exceeded your monthly question limit',
                            details: {
                                questionsUsed: usage.questions_used,
                                questionsLimit: usage.questions_limit,
                                upgradeUrl: '/api/subscriptions/create-checkout-session'
                            },
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }
        } catch (error) {
            logger.error('Usage check error:', error);
            // Continue without usage tracking if there's an error
        }
    }
  
    if (!process.env.OPENAI_API_KEY) {
        logger.error("Missing OpenAI API key in environment");
        return res.status(500).json({ error: "Server configuration error" });
    }
  
    try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
                stream,
            }),
        });
    
        const data = await openaiRes.json();
    
        if (!openaiRes.ok) {
            logger.error("OpenAI API error:", data.error);
            return res.status(openaiRes.status).json({ 
                error: data.error?.message || "OpenAI service error" 
            });
        }
    
        // If user is authenticated, increment usage count
        if (user) {
            try {
                await query(
                    `INSERT INTO usage_tracking (user_id, month_year, questions_used, questions_limit)
                     VALUES ($1, $2, 1, $3)
                     ON CONFLICT (user_id, month_year)
                     DO UPDATE SET questions_used = usage_tracking.questions_used + 1, updated_at = NOW()`,
                    [user.id, new Date().toISOString().slice(0, 7), 
                     user.planType === 'premium' ? 100 : 50]
                );
            } catch (error) {
                logger.error('Usage increment error:', error);
                // Don't fail the request if usage tracking fails
            }
        }
    
        // Log successful requests in production
        if (NODE_ENV === "production") {
            logger.info(`Chat completion successful - Model: ${model}, Messages: ${messages.length}, User: ${user?.id || 'anonymous'}`);
        }
    
        res.json(data);
    } catch (err) {
        logger.error("Server error:", err);
        res.status(500).json({ 
            error: NODE_ENV === "production" ? "Internal server error" : err.message 
        });
    }
});

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error("Unhandled error:", err);
    res.status(500).json({ 
        error: NODE_ENV === "production" ? "Internal server error" : err.message 
    });
});

// Initialize cron jobs
initializeCronJobs();

app.listen(PORT, () => {
    logger.info(`✅ AI Calendar Backend listening on port ${PORT}`);
    logger.info(`🌍 Environment: ${NODE_ENV}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔒 CORS enabled for Chrome extensions`);
    logger.info(`📊 Database connected`);
    logger.info(`💳 Stripe integration ready`);
    logger.info(`🔐 Authentication system active`);
});
