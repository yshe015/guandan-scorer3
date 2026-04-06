FROM node:22

WORKDIR /app

RUN mkdir -p /app/logs

RUN npm cache clean --force && rm -rf node_modules 
COPY package-lock.json ./

COPY . .
RUN npm ci --include=dev --legacy-peer-deps --prefer-offline
RUN node node_modules/vite/bin/vite.js build

EXPOSE 3000

CMD ["node", "src/server.js"]
