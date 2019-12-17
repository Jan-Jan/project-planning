`use strict`

const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')
const { produce } = require('immer')
const chalk = require('chalk')
const moment = require('moment')
const graphlib = require('graphlib')
const Holidays = require('date-holidays')
const { DateTime } = require('luxon')
const {
  error,
  warn,
  isDefined,
  arrayify,
  dateStr,
  momentize,
} = require('./utils')


const isInvalidDate = date =>
  dateStr(date) == `Invalid date`


const maybeValidDate = dateStr =>
  dateStr.match(/^\d{2,4}-\d{1,2}-\d{1,2}$/)


const unavailableKeys = (staffKey, arr) => {
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
    
    // if second entry is a not date, then finish defaults to start
    let finish = momentize(entry[1] || `gibberish`)
    if(isInvalidDate(finish)) {
      finish = momentize(dateStr(start))
    }

    if (value == entry[1] && maybeValidDate(entry[1])) {
      error(`"${entry[1]}" is not a valid date (see "[${entry}]" of staff.${staffKey}'s unavailable values) -- using "${dateStr(finish)}" instead`)
    }
 
    for(finish.add(1, `days`); start.isBefore(finish); start.add(1, `days`)) {
      unavail[dateStr(start)] = value
    }
  }
  return unavail
}


const lowerCase3 = arr =>
  arr.reduce((acc,cur) => ([ ...acc, cur.toLowerCase().slice(0,3) ]), [])


const weekendArrayify = val =>
  lowerCase3(Array.isArray(val) ? val : [`sat`, `sun`])


const reverseWeekends = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}


const weekendKeys = arr =>
  arr.reduce((acc,key) => ({ ...acc, [reverseWeekends[key]]: key }), {})


const defaultsStaff = config =>
  produce(config, draft => {
    for (const key in draft.staff) {
      const refStaff = draft.staff[key]
    
      !isDefined(refStaff.office)
        && warn(`"office" is not set for "staff.${key}" (ie, no public holidays will be considered)`)

      
      refStaff.office && !isDefined(config.office[refStaff.office])
        && error(`"${refStaff.office}" is not defined under "office", but referenced by "staff.${key}"`)

      draft.staff[key] = {
        ...refStaff,
        key,
        name: refStaff.name || key,
        unavailable: unavailableKeys(key, arrayify(refStaff.unavailable)),
        weekends: weekendKeys(weekendArrayify(refStaff.weekends)),
        commitment: refStaff.commitment || 1,
        region: refStaff.office && config.office[refStaff.office],
      }
    }
  })


const defaultsTasks = config =>
  produce(config, draft => {
    for (const key in draft.tasks) {
      const {
        days,
        fat,
        ...refTask
      } = draft.tasks[key]

      !isDefined(refTask.staff)
        && error(`"tasks.${key}.staff" is not set (calculations done on 7 day work week with no off time)`)

      !isDefined(days)
        && warn(`"tasks.${key}.days" is not set (defaults to 1)`)
      
      const optimistic = days || 1; // a 1 day task finishes on the same day, so 0 has no meaning

      draft.tasks[key] = {
        ...refTask,
        title: refTask.title || key,
        optimistic,
        pessimistic: optimistic + (fat || 0),
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


module.exports = defaults
