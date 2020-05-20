SHELL:=/bin/bash
DIR := ${CURDIR}

test-env: container-contract

# -------------------- Dev Containers -------------------- #
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
	@docker pull wanseob/zkopru-contract
	@docker pull wanseob/zkopru-circuits
	@docker pull wanseob/zkopru-circuits-test
