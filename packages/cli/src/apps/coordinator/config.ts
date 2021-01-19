import axios from 'axios'

export const DEFAULT = {
  address: '0x970e8f18ebfEa0B08810f33a5A40438b9530FBCF',
  bootstrap: true,
  websocket: 'ws://goerli.zkopru.network:8546',
  maxBytes: 131072,
  priceMultiplier: 48,
  port: 8888,
  maxBid: 20000,
  daemon: false,
}

export const externalIp = async () => {
  const { data: { ip } } = await axios.get('https://external-ip.now.sh')
  return ip
}
