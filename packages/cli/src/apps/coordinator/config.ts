import axios from 'axios'

export const DEFAULT = {
  address: '0xCDD5C38A39fDC9C77fE3a72998d34c8Ce99d2d34',
  bootstrap: true,
  websocket: 'ws://goerli.zkopru.network:8546',
  maxBytes: 131072,
  priceMultiplier: 48,
  port: 8888,
  maxBid: 20000,
  daemon: false,
}

export async function externalIp() {
  const {
    data: { ip },
  } = await axios.get('https://external-ip.now.sh')
  return ip
}
