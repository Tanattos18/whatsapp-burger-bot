FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium
ENV DISPLAY=:99

RUN mkdir -p /app

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

RUN mkdir -p /app/.wwebjs_auth /app/.wwebjs_cache

EXPOSE 3000

CMD ["node", "index.js"]