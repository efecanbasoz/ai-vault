FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/
COPY vault/ ./vault/
COPY templates/ ./templates/

# Build
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
