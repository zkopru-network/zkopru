import tar from 'tar'
import fs from 'fs'
import { loadCircuits } from './testset-zktxs'

loadCircuits()
  .then(() => {
    tar
      .c({}, ['keys/pks', 'keys/vks', 'keys/circuits'])
      .pipe(fs.createWriteStream('keys.tgz'))
  })
  .catch(console.error)
