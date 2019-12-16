#!/usr/bin/env node
`use strict`

const toml = require('toml')
const fs = require('fs').promises
const { promisify } = require('util')

const defaults = require('./lib/defaults')
const graphify = require('./lib/graphify')
const output = require('./lib/output')
const {
  arrayify,
} = require('./lib/utils')

const argv = require('yargs')
  .usage('Usage: $0 -i [file1] [file2]')
  .alias('i', 'input')
  .default('i', ['plan'])
  .describe('i', 'load input from specified files (the ".toml" extension will be added)')
  .help('h')
  .alias('h', 'help')
  .argv;


const read = async files => {
  let config = {}
  for (const file of files) {
    const input = toml.parse((await fs.readFile(`${file}.toml`)).toString())
    config = { ...config, ...input }
  }
  return config
}

const run = async () => {
  try {
    const files = arrayify(argv.i)
    const config = await read(files)
    const results = output(graphify(defaults(config)))
    await fs.writeFile(`${files.join('-')}.html`, results)
  } catch (err) {
    console.error(err)
  }
}

run()

