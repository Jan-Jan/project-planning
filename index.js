`use strict`

const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')

const defaults = require('./lib/defaults')
const graphify = require('./lib/graphify')
//const output = require('./lib/output')


const readFileAsync = promisify(fs.readFile)


const writeFileAsync = promisify(fs.writeFile)


const throwError = errMsg => {
  throw new Error(chalk.red.bold(errMsg))
}


const run = async () => {
  try {
    const res = (await readFileAsync('plan.toml')).toString()
    const results = graphify(defaults(toml.parse(res)))
  
  } catch (err) {
    console.error(err)
  }
}

run()

