`use strict`

const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')
const { produce } = require('immer')
const chalk = require('chalk')
const moment = require('moment')


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

const dateStr = date =>
  date.format(`YYYY-MM-DD`)

const momentize = dateStr =>
  moment(dateStr, [`YYYY-MM-DD`, `YYYY-M-DD`, `YYYY-MM-D`, `YYYY-M-D`], true)

const isInvalidDate = date =>
  dateStr(date) == `Invalid date`

const maybeValidDate = dateStr =>
  dateStr.match(/^\d{2,4}-\d{1,2}-\d{1,2}$/)

const unavailableKeys = arr => {
  const unavail = {}

  for (const entry of arr) {
    const lastIdx = entry.length - 1

    const start = momentize(entry[0])
    if (isInvalidDate(start)) {
      throw new Error(`"${entry[0]}" is not a valid date (to use for unavailable staff)`)
    }

    const lastEntry = entry[lastIdx]
    
    // if last entry of array is not a date, then value defaults to "off"
    const value = isInvalidDate(momentize(lastEntry))
      ? lastEntry
      : `off`
    
    if (value == lastEntry && maybeValidDate(lastEntry)) {
      error(`"${lastEntry}" is not a valid date (see "[${entry}]") -- proceeding with start date as finish`)
    }
 
    // if second entry is a not date, then finish defaults to start
    let finish = momentize(entry[1] || `gibberish`)
    if(isInvalidDate(finish)) {
      finish = momentize(dateStr(start))
    }

    for(finish.add(1, `days`); start.isBefore(finish); start.add(1, `days`)) {
      unavail[dateStr(start)] = value
    }
  }
  return unavail
}

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
        unavailable: unavailableKeys(arrayify(refStaff.unavailable)),
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
    //console.log(JSON.stringify(parsed,null,2))

  } catch (err) {
    console.error(err)
  }
}

run()

