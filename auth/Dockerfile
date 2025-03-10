# Build stage
FROM node:22-slim AS builder

WORKDIR /build

# Copy only package files first to leverage cache
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY main.js ./

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy from builder stage
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/main.js ./

# Set user for security
USER node

EXPOSE 3000

CMD ["node", "main.js"]
