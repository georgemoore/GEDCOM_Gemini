# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (with SSL workaround for CI environments)
RUN npm config set strict-ssl false && npm install && npm config set strict-ssl true

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (with SSL workaround for CI environments)
RUN npm config set strict-ssl false && npm install --omit=dev && npm config set strict-ssl true

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "serve"]
