set -x
geth init --datadir data genesis.json
geth account import testnet-key --password testnet-pass --datadir data
geth --dev --dev.period 14 --maxpeers 0 --fakepow --mine --miner.gasprice 1 --miner.threads 2 --miner.gastarget 12000000 --networkid 20200406 --datadir data --http --http.addr 0.0.0.0 --http.port 5000 --http.vhosts '*' --http.corsdomain '*' --rpc.allow-unprotected-txs --http.api eth,net,web3,debug,personal,miner --ws --ws.addr 0.0.0.0 --ws.port 5000 --ws.api eth,net,web3,debug,personal --ws.rpcprefix '/' --ws.origins '*' --unlock 90f8bf6a479f320ead074411a4b0e7944ea8c9c1 --password testnet-pass --allow-insecure-unlock &
sleep 10
truffle migrate --network testnet 
nc -w 10 coordinator 5354
tail -f /dev/null