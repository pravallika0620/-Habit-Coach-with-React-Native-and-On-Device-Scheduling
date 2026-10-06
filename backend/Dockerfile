FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production=false

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3000

# Use tsx to run TypeScript directly (no build step needed)
CMD ["node_modules/.bin/tsx", "src/server.ts"]
