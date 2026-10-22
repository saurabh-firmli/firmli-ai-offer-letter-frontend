# Multi-stage Dockerfile for Firmli AI Offer Letter - Frontend

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# VITE_* values are baked into the bundle at build time
ARG VITE_SITE_NAME="Firmli AI Offer Letter"
ARG VITE_API_BASE_URL
ARG VITE_API_TIMEOUT=30000
ENV VITE_SITE_NAME=${VITE_SITE_NAME}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_TIMEOUT=${VITE_API_TIMEOUT}
ENV NODE_ENV=production

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

RUN apk update && apk upgrade && apk add --no-cache ca-certificates
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -G nginx-user && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown nginx-user:nginx-user /var/run/nginx.pid
USER nginx-user

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
