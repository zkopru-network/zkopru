SHELL:=/bin/bash
DIR := ${CURDIR}

test-env: container-contract

# -------------------- Dev Containers -------------------- #
contract-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Contract.dockerfile ./ -t zkopru:contract

circuit-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.dockerfile ./ -t zkopru:circuits

circuit-testing-container:
	$(info Make: build container and compile circuits)
	@docker build -f containers/Circuits.test.dockerfile ./ -t zkopru:circuits-test
