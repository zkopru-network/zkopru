FROM node:16-alpine
RUN apk --no-cache add git
WORKDIR /proj
COPY ./package.json /proj/package.json
# Stub a package json for @zkopru/utils so yarn install works
RUN mkdir /utils && echo '{"version": "0.0.0"}' > /utils/package.json

RUN apk add --no-cache --virtual .gyp \
    python3 \
    make \
    g++ \
    && yarn global add truffle ganache-cli \
    && yarn install \
    && apk del .gyp

COPY ./contracts /proj/contracts
COPY ./utils /proj/utils
COPY ./hardhat.config.ts /proj/hardhat.config.ts
RUN yarn compile
EXPOSE 5000
COPY ./keys /proj/keys
RUN ganache-cli --db=/data -i 20200406 -p 5000 --gasLimit 12000000 --deterministic --host 0.0.0.0 & sleep 5 && yarn hardhat run scripts/deploy.ts --network testnet
CMD ganache-cli --db=/data -b 5 -i 20200406 -p 5000 --gasLimit 12000000 --deterministic --host 0.0.0.0 --gasPrice 2000000000
