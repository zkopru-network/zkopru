FROM node:16-alpine

WORKDIR /proj
COPY ./package.json /proj/package.json
# Stub a package json for @zkopru/utils so yarn install works
RUN mkdir /utils && echo '{"version": "0.0.0"}' > /utils/package.json

RUN apk add --no-cache git
RUN apk add --no-cache --virtual .gyp \
    python3 \
    make \
    g++ \
    && npm install -g truffle ganache-cli --unsafe-perm=true --allow-root \
    && yarn install \
    && apk del .gyp

COPY ./contracts /proj/contracts
COPY ./utils /proj/utils
COPY ./migrations /proj/migrations
COPY ./truffle-config.js /proj/truffle-config.js
RUN truffle compile
EXPOSE 5000
COPY ./keys /proj/keys
RUN ganache-cli --db=/data -i 20200406 --chainId 1337 -p 5000 --gasLimit 12000000 --deterministic --host 0.0.0.0 & sleep 5 && truffle migrate --network integrationtest
CMD ganache-cli --db=/data -i 20200406 --chainId 1337 -p 5000 --gasLimit 12000000 --deterministic --host 0.0.0.0 --gasPrice 2000000000
