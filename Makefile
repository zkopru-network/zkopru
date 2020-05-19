SHELL:=/bin/bash
DIR := ${CURDIR}

test-env: container-contract

# -------------------- Dev Containers -------------------- #
contract-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Contract.dockerfile ./ -t wanseob/zkopru-contract

contract-container-for-integration-test:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Contract.integration.dockerfile ./ -t wanseob/zkopru-contract-integration-test

circuit-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.dockerfile ./ -t wanseob/zkopru-circuits

circuit-testing-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.test.dockerfile ./ -t wanseob/zkopru-circuits-test

# ------------ Pull containers fro docker hub ------------- #
pull-dev-images:
	@docker pull wanseob/zkopru-contract
	@docker pull wanseob/zkopru-circuits
	@docker pull wanseob/zkopru-circuits-test
