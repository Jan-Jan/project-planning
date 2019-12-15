`use strict`

const toml = require('toml')
const fs = require('fs')
const { promisify } = require('util')
const { produce } = require('immer')
const chalk = require('chalk')
const moment = require('moment')
const graphlib = require('graphlib')

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
    
      draft.staff[key] = {
        ...refStaff,
        unavailable: unavailableKeys(key, arrayify(refStaff.unavailable)),
        weekends: weekendKeys(weekendArrayify(refStaff.weekends)),
        commitment: refStaff.commitment || 1,
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
        && error(`"tasks.${key}.staff" is not set`)

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


//-------------------


const throwError = errMsg => {
  throw new Error(chalk.red.bold(errMsg))
}


const isOff = (staff, date) => {
  const isWeekend = false
  const isPublicHoliday = false
  const isUnavailable =  false

  return isWeekend || isPublicHoliday || isUnavailable
}


const process = config => {
  const graph = new graphlib.Graph({ directed: true })

  for (const edgeKey in config.requires) {
    if (!config.tasks[edgeKey]) {
      throwError(`"${edgeKey}" is note defined under "tasks" (but referenced in "requires")`)
    }
    for (const required of config.requires[edgeKey]) {

      if (!config.tasks[required]) {
        throwError(`"${required}" is note defined under "tasks" (but referenced in "requires")`)
      }
      graph.setEdge(required,edgeKey)
    }
  }

  const cycles = graphlib.alg.findCycles(graph)
  if (cycles.length > 0) {
    throwError(`"requires" contains cyclical definition involving "${JSON.stringify(cycles)}"`)
  }

  const subGraphs = graphlib.alg.components(graph)
  if (subGraphs.length > 1) {
    throwError(`Your task requirements specify ${subGraphs.length} sub graphs: ${JSON.stringify(subGraphs)}`)
  }

  const sortedNodes = graphlib.alg.topsort(graph)
  
  for (const node of sortedNodes) {
    const preds = graph.predecessors(node)
    const isStartingNode = preds == undefined || preds.length === 0
    const dates = { optimistic: {}, pessimistic: {} }
    const task = config.tasks[node]
    const staff = config.staff[task.staff]

    if (isStartingNode) {
      // they should have starting dates defined, if not throw error
      if (!task.start) {
        throwError(`task "node" has a missging required "start" field`)
      }
      dates.optimistic.start = momentize(task.start)
      dates.pessimistic.start = momentize(task.start)
    } else { // start is a day after the last preceding task finishes
      for (const predKey of preds) {
        const pred = graph.node(predKey)
console.log(`pred =\n`,JSON.stringify(pred,null,2))
        for (const oppe of ['optimistic' ,'pessimistic']) { 
          const datum = pred.dates[oppe].finish.clone().add(1, 'days')
          for(; isOff(staff, datum); datum.add(1, `days`)) {
          }
          if(!dates[oppe].start || dates[oppe].start.isBefore(datum)) {
            dates[oppe].start = datum
          }
        }
      }
    }

    // calculate finish
    for (const oppe of ['optimistic' ,'pessimistic']) {
      const datum = dates[oppe].start.clone()
      for(let days = task[oppe] - 1; days >0; days--) {
          for(
            datum.add(1, `days`);
            isOff(staff, datum);
            datum.add(1, `days`)
          ) {}
      }
      dates[oppe].finish = datum
    }

console.log(`task for "${node}" =`, JSON.stringify(task,null,2))
console.log(`dates for "${node}" =`, JSON.stringify(dates,null,2))
    graph.setNode(node, { task, staff, dates })

  }

  graphlib.json.write(graph)
}


const run = async () => {
  try {
    const res = (await readFileAsync('plan.toml')).toString()
    const results = process(defaults(toml.parse(res)))
  
  } catch (err) {
    console.error(err)
  }
}

run()

