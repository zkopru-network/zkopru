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
	@docker build -f dockerfiles/Playground.dockerfile ./ -t zkoprunet/playground --no-cache

contract-container:
	$(info Make: build container and compile circuits)
	@docker build -f dockerfiles/Contract.dockerfile ./packages/contracts -t zkoprunet/contracts

contract-container-for-integration-test:
	$(info Make: build container and compile circuits)
	@docker build -f dockerfiles/Contract.integration.dockerfile ./packages/contracts -t zkoprunet/contracts-integration-test

circuit-container:
	$(info Make: build container and compile circuits)
	@docker build -f dockerfiles/Circuits.dockerfile ./packages/circuits -t zkoprunet/circuits

circuit-testing-container:
	$(info Make: build container and compile circuits)
	@docker build -f dockerfiles/Circuits.test.dockerfile ./packages/circuits -t zkoprunet/circuits-test

coordinator-container:
	$(info Make: build container and compile circuits)
	@lerna run build --scope=@zkopru/coordinator
	@docker build -f dockerfiles/Coordinator.dockerfile ./ -t zkoprunet/coordinator

# ------------ Pull dockerfiles fro docker hub ------------- #
build-dev-images:
	@make contract-container
	@make contract-container-for-integration-test
	@make circuit-container
	@make circuit-testing-container
	@make coordinator-container

pull-dev-images:
	@docker pull zkoprunet/contracts:feat35
	@docker pull zkoprunet/contracts-integration-test:feat35
	@docker pull zkoprunet/circuits:feat35
	@docker pull zkoprunet/circuits-test:feat35
