FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/dashboard/package*.json apps/dashboard/
COPY packages/shared/package*.json packages/shared/
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=base /app /app

CMD ["npm", "run", "start:api"]
