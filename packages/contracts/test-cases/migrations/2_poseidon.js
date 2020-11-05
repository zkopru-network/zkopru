/*
 * semaphorejs - Zero-knowledge signaling on Ethereum
 * Copyright (C) 2019 Kobi Gurkan <kobigurk@gmail.com>
 *
 * This file is part of semaphorejs.
 *
 * semaphorejs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * semaphorejs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with semaphorejs.  If not, see <http://www.gnu.org/licenses/>.
 */

const path = require('path')

const poseidonGenContract = require('circomlib/src/poseidon_gencontract.js')
const Artifactor = require('@truffle/artifactor')

const SEED = 'poseidon'

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    const contractsDir = path.join(__dirname, '../../build/contracts')
    const artifactor = new Artifactor(contractsDir)
    const poseidon2 = 'Poseidon2'
    const poseidon3 = 'Poseidon3'
    const poseidon4 = 'Poseidon4'
    await artifactor
      .save({
        contractName: poseidon2,
        abi: poseidonGenContract.abi,
        unlinked_binary: poseidonGenContract.createCode(2),
      })
      .then(async () => {
        const Poseidon = artifacts.require(poseidon2)
        await deployer.deploy(Poseidon)
      })
    await artifactor
      .save({
        contractName: poseidon3,
        abi: poseidonGenContract.abi,
        unlinked_binary: poseidonGenContract.createCode(3),
      })
      .then(async () => {
        const Poseidon = artifacts.require(poseidon3)
        await deployer.deploy(Poseidon)
      })
    await artifactor
      .save({
        contractName: poseidon4,
        abi: poseidonGenContract.abi,
        unlinked_binary: poseidonGenContract.createCode(4),
      })
      .then(async () => {
        const Poseidon = artifacts.require(poseidon4)
        await deployer.deploy(Poseidon)
      })
  })
}
