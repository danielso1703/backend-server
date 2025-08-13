// Authentication Logger for Chrome Extension
import logger from './logger.js';

// Log authentication attempts
export const logAuthAttempt = (req, success, error = null, userEmail = null) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    method: req.method,
    path: req.path,
    success,
    userEmail: userEmail || req.body?.userInfo?.email,
    error: error?.message || null,
    errorCode: error?.code || null
  };

  if (success) {
    logger.info('Authentication successful', logData);
  } else {
    logger.warn('Authentication failed', logData);
  }

  // In production, you might want to send this to a monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to monitoring service
    // sendToMonitoringService('auth_event', logData);
  }
};

// Log token verification attempts
export const logTokenVerification = (req, success, error = null) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    method: req.method,
    path: req.path,
    success,
    error: error?.message || null,
    errorCode: error?.code || null
  };

  if (success) {
    logger.info('Token verification successful', logData);
  } else {
    logger.warn('Token verification failed', logData);
  }
};

// Log user creation/update events
export const logUserEvent = (eventType, userData, success, error = null) => {
  const logData = {
    timestamp: new Date().toISOString(),
    eventType, // 'user_created', 'user_updated'
    userId: userData?.id,
    userEmail: userData?.email,
    googleId: userData?.google_id,
    success,
    error: error?.message || null
  };

  if (success) {
    logger.info(`User ${eventType} successful`, logData);
  } else {
    logger.error(`User ${eventType} failed`, logData);
  }
};

// Log suspicious activity
export const logSuspiciousActivity = (req, activityType, details) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    activityType,
    details,
    severity: 'high'
  };

  logger.error('Suspicious activity detected', logData);

  // In production, immediately alert security team
  if (process.env.NODE_ENV === 'production') {
    // Example: Send immediate alert
    // sendSecurityAlert(logData);
  }
};

// Track authentication metrics
export const trackAuthMetrics = (eventType, data = {}) => {
  const metricData = {
    timestamp: new Date().toISOString(),
    eventType,
    ...data
  };

  logger.info('Authentication metric', metricData);

  // In production, send to metrics service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to metrics service
    // sendToMetricsService('auth_metric', metricData);
  }
};

// Rate limiting violation logger
export const logRateLimitViolation = (req, limit, windowMs) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    limit,
    windowMs,
    path: req.path,
    method: req.method
  };

  logger.warn('Rate limit violation', logData);

  // Check if this looks like an attack
  if (req.path.includes('/auth') && req.method === 'POST') {
    logSuspiciousActivity(req, 'rate_limit_violation', {
      limit,
      windowMs,
      path: req.path
    });
  }
};

// Chrome extension specific logging
export const logChromeExtensionAuth = (req, success, error = null) => {
  const isChromeExtension = req.get('Origin')?.includes('chrome-extension://');
  
  const logData = {
    timestamp: new Date().toISOString(),
    clientType: isChromeExtension ? 'chrome_extension' : 'web',
    extensionId: isChromeExtension ? req.get('Origin')?.split('//')[1] : null,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    success,
    error: error?.message || null,
    userEmail: req.body?.userInfo?.email
  };

  if (success) {
    logger.info('Chrome extension authentication', logData);
  } else {
    logger.warn('Chrome extension authentication failed', logData);
  }
};

export default {
  logAuthAttempt,
  logTokenVerification,
  logUserEvent,
  logSuspiciousActivity,
  trackAuthMetrics,
  logRateLimitViolation,
  logChromeExtensionAuth
};
