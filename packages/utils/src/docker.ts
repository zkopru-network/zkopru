import { ReadStream } from 'fs'
import { Docker } from 'node-docker-api'
import { Container } from 'node-docker-api/lib/container'
import tar from 'tar'

export async function getContainer(
  imageName: string,
  option?: {
    containerName?: string
    socketPath?: string
  },
): Promise<Container> {
  const docker = new Docker({
    socketPath: option?.socketPath || '/var/run/docker.sock',
  })
  const name =
    option?.containerName ||
    Math.random()
      .toString(36)
      .substring(2, 16)
  let container: Container
  try {
    container = await docker.container.create({
      Image: imageName,
      name,
      rm: true,
    })
  } catch {
    container = docker.container.get(name)
  }
  return container
}

export async function readFromContainer(
  container: Container,
  path: string,
): Promise<Buffer> {
  const data: any[] = []
  const stream: ReadStream = (await container.fs.get({ path })) as ReadStream
  return new Promise<Buffer>(res => {
    stream.pipe(
      tar.t({
        onentry: entry => {
          entry.on('data', c => data.push(c))
          entry.on('end', () => {
            res(Buffer.concat(data))
          })
        },
      }),
    )
  })
}
