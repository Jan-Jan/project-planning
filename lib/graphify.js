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


const throwError = errMsg => {
  throw new Error(chalk.red.bold(errMsg))
}


const isOff = (staff, datum) => {
  if(!staff) {
    return false
  }

  const isWeekend = staff.weekends[datum.day()]
  const isUnavailable = staff.unavailable[dateStr(datum)]

  let isPublicHoliday = false
  if (staff.region) {
    const hd = new Holidays()
    hd.init(...staff.region)
    
    const midMorning = DateTime.fromISO(`${dateStr(datum)}T09:00:00`, { zone: hd.__timezone }).toJSDate()
    const midAfternoon = DateTime.fromISO(`${dateStr(datum)}T15:00:00`, { zone: hd.__timezone }).toJSDate()
    isPublicHoliday = hd.isHoliday(midMorning) || hd.isHoliday(midAfternoon)
  }

  return isWeekend || isPublicHoliday || isUnavailable
}


const incForOffDays = (staff, datum) => {
  for(; isOff(staff, datum); datum.add(1, `days`)) {}  
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
        for (const oppe of ['optimistic' ,'pessimistic']) { 
          const datum = pred.dates[oppe].finish.clone().add(1, 'days')
          incForOffDays(staff,datum)
          if(!dates[oppe].start || dates[oppe].start.isBefore(datum)) {
            dates[oppe].start = datum
          }
        }
      }
    }

    for (const oppe of ['optimistic' ,'pessimistic']) {
      const datum = dates[oppe].start.clone()
      incForOffDays(staff,datum)
      for(let days = task[oppe] - 1; days >0; datum.add(1, `days`) && days--) {
        incForOffDays(staff,datum)
      }
      dates[oppe].finish = datum
    }

    graph.setNode(node, { task, staff, dates })
  }

  console.log(graphlib.json.write(graph))
  return graph
}

module.exports = process
