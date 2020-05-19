FROM node:12-alpine
RUN apk add --no-cache --virtual .gyp \
        python \
        make \
        g++ \
    && npm install -g truffle ganache-cli \
    && apk del .gyp
WORKDIR /proj
COPY ./packages/contracts/package.json /proj/package.json
RUN npm install
COPY ./packages/contracts/contracts /proj/contracts
COPY ./packages/contracts/utils /proj/utils
COPY ./packages/contracts/migrations /proj/migrations
COPY ./packages/contracts/truffle-config.js /proj/truffle-config.js
RUN truffle compile
EXPOSE 5000
RUN ganache-cli --db=/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0 & sleep 5 && truffle migrate --network integrationtest
CMD ganache-cli --db=/data -i 20200406 -p 5000 --deterministic --host 0.0.0.0