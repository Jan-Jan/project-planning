`use strict`

const chalk = require('chalk')
const moment = require('moment')


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


module.exports = {
  error,
  warn,
  isDefined,
  arrayify,
  dateStr,
  momentize,
}

