#!/bin/bash
eval $(minikube -p minikube docker-env)

# Create Image in Local
docker-compose -f docker-compose.instant-block.yml build

# Change docker image names for kubernetes
docker image tag zkopru_testnet:latest zkopru/testnet:latest
docker image tag zkopru_coordinator:latest zkopru/coordinator:latest
docker image tag zkopru_wallet:latest zkopru/wallet:latest

# Run kubenetes pods
minikube kubectl -- apply -f ./dockerfiles/templates/testnet.yaml
minikube kubectl -- apply -f ./dockerfiles/templates/coordinator.yaml
minikube kubectl -- apply -f ./dockerfiles/templates/wallet.yaml

