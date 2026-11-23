FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev && npm cache clean --force
COPY src ./src
COPY vendor ./vendor
RUN mkdir -p .cache /output
ENV NODE_ENV=production
CMD ["node", "src/company-worker.mjs"]
