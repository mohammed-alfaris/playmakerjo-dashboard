# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=https://api.yallanhjez.com/api/v1
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MOCK_API=false

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
