FROM alpine:latest

# Installs latest Chromium (100) package.
RUN apk add --update --no-cache \
      chromium \
      nodejs \
      npm

COPY ./ /var/chatgpt-api

WORKDIR /var/chatgpt-api
RUN npm ci --no-color --quiet

# Do not use puppeteer embedded chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV API_HOST=0.0.0.0

EXPOSE 3000

ENTRYPOINT npm start
