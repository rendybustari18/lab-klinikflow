FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb* bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY . .
# T02: akun demo & sandi bawaan hanya dibundel bila VITE_LAB_MODE=true.
ARG VITE_LAB_MODE=false
ENV VITE_LAB_MODE=$VITE_LAB_MODE
RUN bun run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

