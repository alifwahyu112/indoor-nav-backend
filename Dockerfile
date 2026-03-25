# Multi-stage build untuk production-ready image

# Stage 1: Dependencies (Builder)
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dumb-init untuk proper signal handling
RUN apk add --no-cache dumb-init

# Copy node_modules dari builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY package*.json ./
COPY server.js ./
COPY views/ ./views/

# Create non-root user untuk security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch ke non-root user
USER nodejs

# Expose port (Cloud Run uses port 8080 by default, tapi kita listen di 8000)
# Cloud Run akan set PORT environment variable
ENV PORT=8080
ENV HOST=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT}', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init untuk proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
