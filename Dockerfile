# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Note: If you encounter SSL certificate issues in corporate/CI environments,
# you may need to temporarily disable SSL with: npm config set strict-ssl false
# However, this should ONLY be used in trusted environments and never in production builds
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Note: If you encounter SSL certificate issues in corporate/CI environments,
# you may need to temporarily disable SSL with: npm config set strict-ssl false
# However, this should ONLY be used in trusted environments and never in production builds
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "serve"]
