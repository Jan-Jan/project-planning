const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')
const { produce } = require('immer')
const chalk = require('chalk')

const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)

const error = str =>
  console.log(chalk.red.bold(`ERROR: ` + str))


const warn = str =>
  console.log(chalk.bold(`WARNING: ` + str))


const isDefined = val =>
  !(val === null || val === undefined)

const arrayify = val =>
  Array.isArray(val)
    ? val
    : [val].filter(isDefined)

const lowerCase = arr =>
  arr.reduce((acc,cur) => ([ ...acc, cur.toLowerCase() ]), [])

const weekendArrayify = val =>
  lowerCase(Array.isArray(val) ? val : [`sat`, `sun`])

const weekendKeys = arr =>
  arr.reduce((acc,key) => ({ ...acc, [key]: `weekend` }), {})

const defaultsStaff = config =>
  produce(config, draft => {
    for (const key in draft.staff) {
      const refStaff = draft.staff[key]
    
      draft.staff[key] = {
        ...refStaff,
        unavailable: arrayify(refStaff.unavailable),
        weekends: weekendKeys(weekendArrayify(refStaff.weekends)),
        commitment: refStaff.commitment || 1,
      }
    }
  })

const defaultsTasks = config =>
  produce(config, draft => {
    for (const key in draft.tasks) {
      const refTask = draft.tasks[key]

      !isDefined(refTask.staff)
        && error(`"tasks.${key}.staff" is not set`)

      !isDefined(refTask.days)
        && warn(`"tasks.${key}.days" is not set (defaults to 0)`)
      
      draft.tasks[key] = {
        ...refTask,
        title: refTask.title || key,
        days: refTask.days || 0,
        fat: refTask.fat || 0,
      }
    }
  })

const defaultsRequires = config =>
  produce(config, draft => {
    for (const key in draft.requires) {
      draft.requires[key] = arrayify(draft.requires[key])
    }
  })

const defaults = config => 
  defaultsStaff(defaultsTasks(defaultsRequires(config)))


const run = async () => {
  try {
    const res = (await readFileAsync('plan.toml')).toString()
    //console.log(res)
    const parsed = defaults(toml.parse(res))
    console.log(JSON.stringify(parsed,null,2))

  } catch (err) {
    console.error(err)
  }
}

run()

