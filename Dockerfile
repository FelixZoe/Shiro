FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
  && corepack prepare pnpm@10.27.0 --activate \
  && npm install -g sharp

FROM base AS deps

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

FROM base AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY --from=deps /app/ .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Shiro uses next-runtime-env, so these values can still be overridden when the
# container starts. Build defaults only keep Next.js compilation deterministic.
ARG NEXT_PUBLIC_API_URL=/api/v3
ARG NEXT_PUBLIC_CLIENT_API_URL=
ARG NEXT_PUBLIC_GATEWAY_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_CLIENT_API_URL=${NEXT_PUBLIC_CLIENT_API_URL}
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}

RUN pnpm --filter @shiro/web build:ci

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2323
ENV HOSTNAME=0.0.0.0
ENV NEXT_SHARP_PATH=/usr/local/lib/node_modules/sharp

# Docker Compose overrides these with the internal Core URL and the public
# browser URL. They are safe local-development defaults for a standalone image.
ENV NEXT_PUBLIC_API_URL=http://host.docker.internal:2333/api/v3
ENV NEXT_PUBLIC_CLIENT_API_URL=http://localhost:2333/api/v3
ENV NEXT_PUBLIC_GATEWAY_URL=http://localhost:2333

# Fonts required by server-side image and typography rendering.
RUN apk add --no-cache fontconfig wget curl unzip \
  && mkdir -p /usr/share/fonts/truetype/chinese /usr/share/fonts/truetype/english \
  && wget -O /usr/share/fonts/truetype/chinese/LXGWWenKai-Regular.ttf \
    https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Regular.ttf \
  && wget -O /usr/share/fonts/truetype/chinese/LXGWWenKai-Medium.ttf \
    https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Medium.ttf \
  && wget -O /usr/share/fonts/truetype/chinese/LXGWWenKai-Light.ttf \
    https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Light.ttf \
  && wget -O /tmp/geist.zip \
    https://github.com/vercel/geist-font/releases/download/1.5.0/geist-font-1.5.0.zip \
  && unzip /tmp/geist.zip -d /tmp/geist \
  && find /tmp/geist -name '*.ttf' -exec cp {} /usr/share/fonts/truetype/ \; \
  && rm -rf /tmp/geist.zip /tmp/geist \
  && fc-cache -fv

# Next standalone output for this monorepo starts at /app/apps/web/server.js.
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/.next/server ./apps/web/.next/server

EXPOSE 2323

CMD ["node", "apps/web/server.js"]
