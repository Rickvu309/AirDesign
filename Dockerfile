FROM node:24-bookworm AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:24-bookworm
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright AIRDESIGN_ISOLATION=container
WORKDIR /app
COPY --from=build /app /app
RUN apt-get update && apt-get install -y --no-install-recommends util-linux ca-certificates && npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* && mkdir -p /data /home/node/tmp && chown -R node:node /data /home/node /ms-playwright
USER node
EXPOSE 3000
CMD ["npm", "run", "start:web"]
