import { Wallet } from 'ethers'

export async function getL2PrivateKeyBySignature(
  wallet: Wallet,
): Promise<string> {
  const domain = {
    chainId: (await wallet.provider.getNetwork()).chainId,
    name: 'Zkopru Testnet',
    version: '0',
  }
  const message = {
    info: 'Unlock Zkopru wallet',
    warning:
      'This signature is your private key, only sign on official Zkopru websites!',
  }
  const types = {
    ZkopruKey: [
      { name: 'info', type: 'string' },
      { name: 'warning', type: 'string' },
    ],
  }
  const signedData = await wallet._signTypedData(domain, types, message)
  const { sha512_256 } = await import(/* webpackPrefetch: true */ 'js-sha512')
  return sha512_256(signedData)
}
