FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

ARG NPM_VERSION=11.18.0
ARG BROWSER_HARNESS_VERSION=0.1.3
ENV PATH="/root/.local/bin:${PATH}"
RUN npm install -g npm@${NPM_VERSION}
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && uv tool install --python 3.12 --force browser-harness==${BROWSER_HARNESS_VERSION} \
  && browser-harness telemetry disable

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["node", "src/cli.js"]
