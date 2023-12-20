FROM node:14.18-alpine
ENV APP_DIR=/usr/local/src/app

WORKDIR ${APP_DIR}
ARG NPMAccessToken
RUN echo "//registry.npmjs.org/:_authToken=$NPMAccessToken" > ./.npmrc
COPY package*.json ./
RUN npm ci --ignore-engines && cd "$APP_DIR/node_modules/@mapbox/watchbot" && npm link && cd $APP_DIR
COPY . .
RUN chmod 0555 index.js
