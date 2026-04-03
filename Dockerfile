FROM node:18

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies with legacy peer deps
RUN npm install --include=dev --legacy-peer-deps

# Copy source code
COPY . .

# Build
RUN npx vite build

EXPOSE 3000

CMD ["node", "src/server.js"]
