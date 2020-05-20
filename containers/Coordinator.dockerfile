FROM node:12-alpine
RUN apk add --no-cache --virtual .gyp \
        python \
        make \
        g++ \
    && npm install -g truffle ganache-cli \
    && apk del .gyp
WORKDIR /packages

# Copy package.json
COPY ./packages/account/package.json /packages/account/package.json
COPY ./packages/babyjubjub/package.json /packages/babyjubjub/package.json
COPY ./packages/contracts/package.json /packages/contracts/package.json
COPY ./packages/coordinator/package.json /packages/coordinator/package.json
COPY ./packages/core/package.json /packages/core/package.json
COPY ./packages/database/package.json /packages/database/package.json
COPY ./packages/transaction/package.json /packages/transaction/package.json
COPY ./packages/tree/package.json /packages/tree/package.json
COPY ./packages/utils/package.json /packages/utils/package.json

# Install packages
RUN cd account && yarn install
RUN cd coordinator && yarn install
RUN cd babyjubjub && yarn install
RUN cd contracts && yarn install
RUN cd core && yarn install
RUN cd database && yarn install
RUN cd transaction && yarn install
RUN cd tree && yarn install
RUN cd utils && yarn install

# Copy dist
COPY ./packages/account/dist /packages/account/dist
COPY ./packages/babyjubjub/dist /packages/babyjubjub/dist
COPY ./packages/contracts/dist /packages/contracts/dist
COPY ./packages/coordinator/dist /packages/coordinator/dist
COPY ./packages/core/dist /packages/core/dist
COPY ./packages/database/dist /packages/database/dist
COPY ./packages/transaction/dist /packages/transaction/dist
COPY ./packages/tree/dist /packages/tree/dist
COPY ./packages/utils/dist /packages/utils/dist

COPY ./packages/coordinator/coordinator.json /packages/coordinator/coordinator.json
EXPOSE 8888
CMD node /packages/coordinator/dist/cli/index.js --ws ws://localhost:5000 --config /packages/coordinator/coordinator.json
