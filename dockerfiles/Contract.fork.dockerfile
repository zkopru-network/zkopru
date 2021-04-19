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
COPY ./hardhat.config-fork.js /proj/hardhat.config.js
COPY ./truffle-config.js /proj/truffle-config.js
EXPOSE 5000
COPY ./keys /proj/keys
CMD npx hardhat node --hostname 0.0.0.0 --port 5000