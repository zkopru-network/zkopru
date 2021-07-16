FROM ethereum/client-go:v1.10.3 AS base

# Deploy contract on geth private network
FROM node:12-alpine AS stage
COPY --from=base /usr/local/bin/geth /usr/local/bin/geth
RUN apk add --no-cache --virtual .gyp \
    python \
    make \
    g++ \
    && npm install -g truffle --unsafe-perm=true --allow-root \
    && apk del .gyp
RUN apk add git curl
WORKDIR /proj
COPY ./package.json /proj/package.json
# Stub a package json for @zkopru/utils so yarn install works
RUN mkdir /utils && echo '{"version": "0.0.0"}' > /utils/package.json
RUN yarn install
COPY ./contracts /proj/contracts
COPY ./utils /proj/utils
COPY ./migrations /proj/migrations
COPY ./truffle-config.js /proj/truffle-config.js
RUN truffle compile 
EXPOSE 5000
COPY ./keys /proj/keys
COPY ./genesis.json /proj/genesis.json
COPY ./testnet-key /proj/testnet-key
COPY ./testnet-pass /proj/testnet-pass
COPY ./run_geth.sh /proj/run_geth.sh
CMD ["geth", "--dev", "--networkid", "20200406", "--datadir", "data", "--rpc", "--rpcaddr", "0.0.0.0", "--rpccorsdomain", "*","--http.api", "eth,net,web3,personal,miner", "--nousb"]
