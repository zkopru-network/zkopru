SHELL:=/bin/bash
DIR := ${CURDIR}

test-env: container-contract

# -------------------- Dev Containers -------------------- #
develop:
	$(info Make: yarn build:ts && docker-compose -f docker-compose.dev.yml up --build)
	@yarn build:ts
	@docker-compose -f docker-compose.dev.yml up --build --force-recreate -V

develop-instant:
	$(info Make: yarn build:ts && docker-compose -f docker-compose.dev.yml up --build)
	@yarn build:ts
	@docker-compose -f docker-compose.instant-block.yml up --build --force-recreate -V

playground-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Playground.dockerfile ./ -t zkoprunet/playground --no-cache

contract-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Contract.dockerfile ./packages/contracts -t wanseob/zkopru-contract

contract-container-for-integration-test:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Contract.integration.dockerfile ./packages/contracts -t wanseob/zkopru-contract-integration-test

circuit-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.dockerfile ./ -t wanseob/zkopru-circuits

circuit-testing-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.test.dockerfile ./ -t wanseob/zkopru-circuits-test

coordinator-container:
	$(info Make: build container and compile circuits)
	@lerna run build --scope=@zkopru/coordinator
	@docker build -f containers/Coordinator.dockerfile ./ -t wanseob/zkopru-coordinator

# ------------ Pull containers fro docker hub ------------- #
pull-dev-images:
	@docker pull wanseob/zkopru-contract:0.0.1
	@docker pull wanseob/zkopru-contract-integration-test:0.0.1
	@docker pull wanseob/zkopru-circuits:0.0.1
	@docker pull wanseob/zkopru-circuits-test:0.0.1
