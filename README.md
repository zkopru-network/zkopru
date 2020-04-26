# zkopru

[WIP]

## What is zkopru?

[WIP]

## Development

### Prerequisites

You need docker & docker-compose for integration test

* Get [docker](https://docs.docker.com/get-docker/)
* Get [docker-compose](https://docs.docker.com/compose/install/)

### Testing

```shell
yarn install
yarn build
yarn test
```

### Module dev

```shell
lerna run build --scope=@zkopru/modulename
lerna run test --scope=@zkopru/modulename
```
