FROM node:18

WORKDIR /app

COPY package.json ./

RUN npm install --include=dev --legacy-peer-deps

COPY . .

RUN npx vite build

EXPOSE 3000

CMD ["node", "src/server.js"]
