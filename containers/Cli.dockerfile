FROM node:14-alpine
RUN apk add --no-cache git make musl-dev go
RUN apk add --no-cache sqlite postgresql-client
RUN apk add --no-cache tmux

# Configure Go
ENV GOROOT /usr/lib/go
ENV GOPATH /go
ENV PATH /go/bin:$PATH

RUN mkdir -p ${GOPATH}/src ${GOPATH}/bin

# Install Gotty
RUN go get github.com/yudai/gotty

RUN apk add --no-cache python g++ git
RUN npm install  -g node-gyp-build
RUN npm install -g lerna
WORKDIR /proj

# Copy SNARK keys
COPY ./keys /proj/keys

# Copy package.json
COPY ./.package-dev.json /proj/package.json
COPY ./lerna.json /proj/lerna.json
COPY ./packages/account/package.json /proj/packages/account/package.json
COPY ./packages/babyjubjub/package.json /proj/packages/babyjubjub/package.json
COPY ./packages/contracts/package.json /proj/packages/contracts/package.json
COPY ./packages/coordinator/package.json /proj/packages/coordinator/package.json
COPY ./packages/cli/package.json /proj/packages/cli/package.json
COPY ./packages/core/package.json /proj/packages/core/package.json
COPY ./packages/prisma/package.json /proj/packages/prisma/package.json
COPY ./packages/transaction/package.json /proj/packages/transaction/package.json
COPY ./packages/tree/package.json /proj/packages/tree/package.json
COPY ./packages/utils/package.json /proj/packages/utils/package.json
COPY ./packages/zk-wizard/package.json /proj/packages/zk-wizard/package.json

RUN yarn install

# Copy dist
COPY ./packages/account/dist /proj/packages/account/dist 
COPY ./packages/babyjubjub/dist /proj/packages/babyjubjub/dist
COPY ./packages/contracts/dist /proj/packages/contracts/dist
COPY ./packages/coordinator/dist /proj/packages/coordinator/dist
COPY ./packages/core/dist /proj/packages/core/dist
COPY ./packages/cli/dist /proj/packages/cli/dist
COPY ./packages/prisma/dist /proj/packages/prisma/dist
COPY ./packages/prisma/generated /proj/packages/prisma/generated
COPY ./packages/prisma/mockup.db /proj/packages/prisma/mockup.db
COPY ./packages/transaction/dist /proj/packages/transaction/dist
COPY ./packages/tree/dist /proj/packages/tree/dist
COPY ./packages/utils/dist /proj/packages/utils/dist
COPY ./packages/zk-wizard/dist /proj/packages/zk-wizard/dist
RUN lerna clean -y --loglevel silent && lerna bootstrap

COPY ./packages/cli/coordinator.*.json /proj/packages/cli/
COPY ./packages/cli/wallet.*.json /proj/packages/cli/
COPY ./packages/prisma/prisma /proj/packages/prisma/prisma
EXPOSE 8888
CMD ["node", "/proj/packages/cli/dist/apps/coordinator/cli.js", "--ws ws://localhost:5000", "--config /proj/packages/cli/coordinator.json"]
