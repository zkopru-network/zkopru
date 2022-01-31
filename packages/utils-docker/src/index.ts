import { createWriteStream, ReadStream } from 'fs'
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
      HostConfig: {
        PortBindings: {
          '5000/tcp': [
            {
              HostIp: '0.0.0.0',
              HostPort: '5000',
            },
          ],
        },
      },
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
  console.log('building..')
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

export async function pullAndGetContainer({
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
  await dockerCompose.pullOne(service, { cwd })
  const container = await getContainer(image, option)
  return container
}

export async function pullOrBuildAndGetContainer({
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
  let container: Container
  try {
    container = await pullAndGetContainer({ compose, service, option })
  } catch (err) {
    container = await buildAndGetContainer({ compose, service, option })
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

export async function copyFromContainer(
  container: Container,
  path: string,
  dest: string,
): Promise<void> {
  const stream: ReadStream = (await container.fs.get({ path })) as ReadStream
  const file = createWriteStream(dest)
  return new Promise<void>(res => {
    stream.pipe(
      tar.t({
        onentry: entry => {
          entry.on('data', c => file.write(c))
          entry.on('end', res)
        },
      }),
    )
  })
}
