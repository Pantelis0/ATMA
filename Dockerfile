FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/dashboard/package*.json apps/dashboard/
COPY packages/shared/package*.json packages/shared/
RUN npm install

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app /app

CMD ["npm", "run", "start:api"]
