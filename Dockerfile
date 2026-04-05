# Stage 1: Build the application
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies (development + production) required for TypeScript build
RUN npm ci

# Copy the rest of the source code
COPY . .

# Compile TypeScript into the /dist directory
RUN npm run build

# Stage 2: Production Image
FROM node:20-alpine AS production

# Set Node to run in production mode
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /usr/src/app

# Copy package properties to install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the build artifacts from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create a config directory in case the code expects the folder to exist
RUN mkdir -p config

# Switch to standard, non-root 'node' user for security
USER node

EXPOSE 3000

# Execute the application directly
CMD ["npm", "start"]
