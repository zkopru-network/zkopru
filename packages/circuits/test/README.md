# Circuit test

1. The test cases are located in `packages/testnet/tests/circuits` directory.

2. To run the test cases, you should build the docker image for the testing circuits. Run
  
    ```shell
    make circuit-testing-container
    ```
  
    on the project root path. It takes 10~15 minutes to build the circuit test environment.


3. Then, go to `packages/testnet` directory and run 

    ```shell
    yarn test
    ```

    Or, you can run

    ```shell
    lerna run test --scope=@zkopru/testnet
    ```

    on your project root.

4. To add test cases, create a circuit into the `packages/circuits/tester` directory and run `make circuit-testing-container` again. Then you can read the artifcats using the following format when your circuit has `tester/${filname}.circom` for its filename.
    - wasm file: `/proj/build/circuits/${filename}.wasm`
    - proving key: `/proj/build/pks/${filename}.pk.json`
    - verifying key: `/proj/build/vks/${filename}.vk.json`

5. You can read the artifacts using `readFromContainer()` function in `packages/utils/src/index.ts` like

    ```typescript
    import { readFromContainer } from '@zkopru/utils'

    const wasm = await readFromContainer(
      container,
      '/proj/build/circuits/note_hash.test.wasm',
    )
    ```

6. For more detail test case, check out `packages/testnet/tests/circuits/notehash.test.ts`
