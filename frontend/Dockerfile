# The proxy image builds the PWA itself, so "docker compose up --build" serves it on a fresh clone.
FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27.5-alpine
COPY --from=build /app/dist /usr/share/nginx/html
