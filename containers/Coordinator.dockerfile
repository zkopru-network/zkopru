FROM node:12-alpine
RUN apk add --no-cache --virtual .gyp \
        python \
        make \
        g++ \
    && npm install  -g node-gyp-build \
    && apk del .gyp
RUN npm install -g lerna
WORKDIR /proj

# Copy package.json
COPY ./.package-dev.json /proj/package.json
COPY ./lerna.json /proj/lerna.json
COPY ./packages/account/package.json /proj/packages/account/package.json
COPY ./packages/babyjubjub/package.json /proj/packages/babyjubjub/package.json
COPY ./packages/contracts/package.json /proj/packages/contracts/package.json
COPY ./packages/coordinator/package.json /proj/packages/coordinator/package.json
COPY ./packages/core/package.json /proj/packages/core/package.json
COPY ./packages/database/package.json /proj/packages/database/package.json
COPY ./packages/transaction/package.json /proj/packages/transaction/package.json
COPY ./packages/tree/package.json /proj/packages/tree/package.json
COPY ./packages/utils/package.json /proj/packages/utils/package.json

RUN yarn install

# Copy dist
COPY ./packages/account/dist /proj/packages/account/dist 
COPY ./packages/babyjubjub/dist /proj/packages/babyjubjub/dist
COPY ./packages/contracts/dist /proj/packages/contracts/dist
COPY ./packages/coordinator/dist /proj/packages/coordinator/dist
COPY ./packages/core/dist /proj/packages/core/dist
COPY ./packages/database/dist /proj/packages/database/dist
COPY ./packages/transaction/dist /proj/packages/transaction/dist
COPY ./packages/tree/dist /proj/packages/tree/dist
COPY ./packages/utils/dist /proj/packages/utils/dist
RUN lerna clean -y --loglevel silent && lerna bootstrap

COPY ./packages/coordinator/coordinator.docker.json /proj/packages/coordinator/coordinator.json
EXPOSE 8888
CMD ["node", "/proj/packages/coordinator/dist/cli/index.js", "--ws ws://localhost:5000", "--config /proj/packages/coordinator/coordinator.json"]
