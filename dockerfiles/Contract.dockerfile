FROM node:12-alpine
RUN apk add --no-cache --virtual .gyp \
    python \
    make \
    g++ \
    && npm install -g truffle --unsafe-perm=true --allow-root \
    && apk del .gyp
RUN apk add git
WORKDIR /proj
COPY ./package.json /proj/package.json
RUN yarn install
COPY ./contracts /proj/contracts
COPY ./utils /proj/utils
COPY ./migrations /proj/migrations
COPY ./hardhat.config.js /proj/hardhat.config.js
EXPOSE 5000
COPY ./keys /proj/keys
RUN npx hardhat --hostname 0.0.0.0 --port 5000
