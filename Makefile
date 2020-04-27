SHELL:=/bin/bash
DIR := ${CURDIR}

test-env: container-contract

# -------------------- Dev Containers -------------------- #
contract-container:
	$(info Make: build container and compile circuits)
	@docker build -q -f containers/Contract.dockerfile ./ -t zkopru:contract

contract-testing-container:
	$(info Make: build container and compile circuits)
	@docker build -q -f containers/ContractTesting.dockerfile ./ -t zkopru:contract-testing
