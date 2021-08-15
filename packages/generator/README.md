# Transaction Generator

## Run Transaction Generator for testing

- Run with docker-compose

  ```shell
  docker-compose -p zkopru -f compose/docker-compose.localtest-geth.yml up
  ```

  > A `-p` flag argument is optional. It is used to the prefix of docker conatiner name.<br>
  > In this case, all container name starts with 'zkopru'

- Run with kubenetes object

  ```shell
  kubectl apply -f dockerfiles/kube.localtest-geth.yaml
  ```
