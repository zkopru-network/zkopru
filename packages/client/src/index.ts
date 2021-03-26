import ZkopruClient from './zkopru-client'

export default ZkopruClient
;(async () => {
  try {
    const client = await ZkopruClient.create('http://localhost:8888')
    await client.start()
  } catch (err) {
    console.log(err)
  }
})()
