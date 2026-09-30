# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=https://api.playmakerjo.com/api/v1
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MOCK_API=false

COPY package.json package-lock.json ./
# Using `npm install` instead of `npm ci` because the lockfile was generated
# on Windows and omits some platform-specific esbuild binaries that Linux needs.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, not localhost: inside the container localhost resolves to ::1 first, and
# nginx listens on IPv4 only — so the check was refused and the container reported
# unhealthy while serving normally.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
