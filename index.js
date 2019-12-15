const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

const run = async () => {
  try {
    const res = (await readFileAsync('plan.toml')).toString()
    //console.log(res)
    const parsed = toml.parse(res)
    console.log(JSON.stringify(parsed,null,2))

  } catch (err) {
    console.error(err)
  }
}

run()

