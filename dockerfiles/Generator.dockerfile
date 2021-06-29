FROM node:14-stretch-slim
RUN apt update
RUN apt install -y git make musl-dev golang-go sqlite g++ tmux curl jq
RUN mkdir -p /usr/share/man/man1
RUN mkdir -p /usr/share/man/man7
RUN apt install -y netcat

# Configure Go
ENV GOROOT /usr/lib/go
ENV GOPATH /go
ENV PATH /go/bin:$PATH

RUN mkdir -p ${GOPATH}/src ${GOPATH}/bin

# Install Gotty (it needs go >= 1.9)
RUN go get golang.org/dl/go1.10.7
RUN go1.10.7 download
RUN go1.10.7 get github.com/yudai/gotty

RUN apt install -y python
# Install Lerna & gyp
RUN npm install -g node-gyp-build
RUN npm install -g lerna
RUN ln -s "$(which nodejs)" /usr/bin/node
WORKDIR /proj

# Copy SNARK keys
COPY ./packages/circuits/keys /proj/keys

# Copy package.json
COPY ./.package-dev.json /proj/package.json
COPY ./lerna.json /proj/lerna.json
COPY ./packages/account/package.json /proj/packages/account/package.json
COPY ./packages/babyjubjub/package.json /proj/packages/babyjubjub/package.json
COPY ./packages/contracts/package.json /proj/packages/contracts/package.json
COPY ./packages/coordinator/package.json /proj/packages/coordinator/package.json
COPY ./packages/cli/package.json /proj/packages/cli/package.json
COPY ./packages/core/package.json /proj/packages/core/package.json
COPY ./packages/database/package.json /proj/packages/database/package.json
COPY ./packages/generator/package.json /proj/packages/generator/package.json
COPY ./packages/transaction/package.json /proj/packages/transaction/package.json
COPY ./packages/tree/package.json /proj/packages/tree/package.json
COPY ./packages/utils/package.json /proj/packages/utils/package.json
COPY ./packages/zk-wizard/package.json /proj/packages/zk-wizard/package.json
COPY ./yarn.lock /proj/yarn.lock

RUN yarn install

# Copy dist
COPY ./packages/account/dist /proj/packages/account/dist
COPY ./packages/babyjubjub/dist /proj/packages/babyjubjub/dist
COPY ./packages/contracts/dist /proj/packages/contracts/dist
COPY ./packages/coordinator/dist /proj/packages/coordinator/dist
COPY ./packages/core/dist /proj/packages/core/dist
COPY ./packages/cli/dist /proj/packages/cli/dist
COPY ./packages/database/dist /proj/packages/database/dist
COPY ./packages/generator/dist /proj/packages/generator/dist
COPY ./packages/transaction/dist /proj/packages/transaction/dist
COPY ./packages/tree/dist /proj/packages/tree/dist
COPY ./packages/utils/dist /proj/packages/utils/dist
COPY ./packages/zk-wizard/dist /proj/packages/zk-wizard/dist
RUN lerna clean -y --loglevel silent && lerna bootstrap

EXPOSE 8888
