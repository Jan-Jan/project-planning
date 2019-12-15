`use strict`

const toml = require('toml')
const fs = require('fs').promises
const { promisify } = require('util')

const defaults = require('./lib/defaults')
const graphify = require('./lib/graphify')
const output = require('./lib/output')


const run = async () => {
  try {
    const res = (await fs.readFile('plan.toml')).toString()
    const results = output(graphify(defaults(toml.parse(res))))
    await fs.writeFile(`plan.html`, results)
  } catch (err) {
    console.error(err)
  }
}

run()

