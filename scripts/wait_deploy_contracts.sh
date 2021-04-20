#!/bin/bash
target_contract=$(cat /proj/packages/cli/coordinator.dev.json | jq .address)

function get_code_length() {
  response_length=$(curl -s -H "Content-Type: application/json" -X POST --data '{"id":1337,"jsonrpc":"2.0","method":"eth_getCode","params":['$target_contract']}' http://$TARGET_HOST:5000 | jq .result | wc -m)
}

while true; do
  get_code_length
  if [[ $response_length -gt 40000 ]]; then
    echo "Zkopru contract deployed, Ready to run"
    break
  else
    echo "Wait for finish deploying Zkopru contract"
    sleep 1
  fi
done
