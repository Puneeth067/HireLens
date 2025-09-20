# Use Node.js 18+ (LTS)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and package-lock.json
COPY package*.json ./

# Copy workspace files
COPY packages/ ./packages/

# Copy client files
COPY client/ ./client/

# Install dependencies including workspaces
RUN npm install

# Build shared packages
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=packages/config

# Build the Next.js application
WORKDIR /app/client
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]