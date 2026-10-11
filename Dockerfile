# File Name: Dockerfile
# ICA: igbot-api
# Auhor: Tanvir Ahmed (Tanvir143)
# GitHub: www.github.com/143tanvir
# WhatsApp: +8801750079773
# Note: Project metadata only; original source credits and license notices are retained.
# Original attribution/license notices below are preserved.

# InstaBOT — production image for Render / Railway / any container host.
#
# Install the bot dependencies, including local igbot-api from Tanvir143/igbot-api.
# The ICA package itself still connects to its configured hosted ICA service.
FROM node:20-alpine

ENV NODE_ENV=production
# The bot ships a tiny status/health server so a host like Render finds an open
# port. Set PORT=0 to disable it (pure worker mode).
ENV PORT=8080

WORKDIR /app

# No committed lockfile: npm install generates node_modules inside the image.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY . .

# Persisted JSON store and uptime journal live under data/.
RUN mkdir -p data && chown -R node:node /app
USER node

EXPOSE 8080

CMD ["node", "index.js"]
