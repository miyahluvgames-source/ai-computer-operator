FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

ARG NPM_VERSION=11.18.0
RUN npm install -g npm@${NPM_VERSION}

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["node", "src/cli.js"]
