import { ReadStream } from 'fs'
import { Docker } from 'node-docker-api'
import * as dockerCompose from 'docker-compose'
import { Container } from 'node-docker-api/lib/container'
import * as pathLib from 'path'
import tar from 'tar'
import jsyaml from 'js-yaml'

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

export async function buildAndGetContainer({
  compose,
  service,
  option,
}: {
  compose: string | string[]
  service: string
  option?: {
    containerName?: string
    socketPath?: string
  }
}): Promise<Container> {
  const cwd = typeof compose === 'string' ? compose : pathLib.join(...compose)
  const config = await dockerCompose.config({ cwd })
  const { services } = jsyaml.load(config.out)
  if (!services[service]) {
    throw Error(
      `"${service}" does not exist. Available services are ${Object.keys(
        services,
      ).reduce((acc, val) => `${acc}\n${val}`, '\n')}`,
    )
  }
  const { image } = services[service]
  if (!image) {
    throw Error(
      `"${service}" does not tag image name. Please update the compose file`,
    )
  }
  await dockerCompose.buildOne(service, { cwd })
  const container = await getContainer(image, option)
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
