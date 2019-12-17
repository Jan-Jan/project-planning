const graphlib = require('graphlib')
const { DateTime } = require('luxon')

const html = ({
  title,
  creationTime,
  numRows,
  optimistic,
  optiFinish,
  pessimistic,
  pessiFinish,
  tasksMaxAbsVar,
  tasksMaxRelVar,
  staffRows,
  staffTotal,
}) => `<html>
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
  <link rel="stylesheet" href="https://code.getmdl.io/1.3.0/material.indigo-pink.min.css">
  <script defer src="https://code.getmdl.io/1.3.0/material.min.js"></script>
  <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
  <script type="text/javascript">
    google.charts.load('current', {'packages':['gantt']});
    google.charts.setOnLoadCallback(drawCharts);

    function drawChart(id, rows) {

      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Task ID');
      data.addColumn('string', 'Task Name');
      data.addColumn('string', 'Resource');
      data.addColumn('date', 'Start Date');
      data.addColumn('date', 'End Date');
      data.addColumn('number', 'Duration');
      data.addColumn('number', 'Percent Complete');
      data.addColumn('string', 'Dependencies');

      data.addRows(rows);

      var options = {
        height: ${(numRows + 1) * 42},
        gantt: {
          criticalPathEnabled: true,
          criticalPathStyle: {
            stroke: '#e64a19',
            strokeWidth: 5
          }
        }
      };

      var chart = new google.visualization.Gantt(document.getElementById(id));

      chart.draw(data, options);
    }
    
    function drawCharts() {
      drawChart('graph_opti',${optimistic})
      drawChart('graph_pessi',${pessimistic})
    }
  </script>
  <style>
    body, .full {
      display: flex;
      flex-flow: row wrap;
      justify-content: space-evenly;
    }
    body {
      margin-bottom: 50px;
    }
    h2,h3,.full {
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="full">
  <h1>${title} (with ${staffTotal} staff)</h1>
  </div>
  <div class="full">
  <h4>generated at ${creationTime}</h4>
  </div>

  <h2>Optimistic (by ${optiFinish})</h2>
  <div class="full" id="graph_opti"></div>

  <h2>Pessimistic (by ${pessiFinish})</h2>
  <div class="full" id="graph_pessi"></div>

  <h2>Risks</h2>

  <div class="half">
  <h3>Tasks: absolute variance (top 5)</h3>
  <table class="mdl-data-table mdl-js-data-table mdl-shadow--2dp">
    <thead>
      <tr>
        <th class="mdl-data-table__cell--non-numeric">Variance</th>
        <th>Task</th>
        <th>Duration [wd]</th>
        <th>Staff</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${tasksMaxAbsVar}
    </tbody>
  </table>
  </div>

  <div class="half">
  <h3>Tasks: relative variance (top 5)</h3>
  <table class="mdl-data-table mdl-js-data-table mdl-shadow--2dp">
    <thead>
      <tr>
        <th class="mdl-data-table__cell--non-numeric">Variance</th>
        <th>Task</th>
        <th>Duration</th>
        <th>Staff</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${tasksMaxRelVar}
    </tbody>
  </table>
  </div>

  <h2>Staff (${staffTotal})</h2>
  <table class="mdl-data-table mdl-js-data-table mdl-shadow--2dp">
    <thead>
      <tr>
        <th class="mdl-data-table__cell--non-numeric">Staff</th>
        <th>Duration</th>
        <th>Commitment</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${staffRows}
    </tbody>
  </table>

</body>
</html>
`

const rowify = rows =>
  rows.map(row => `<tr>${row.reduce((acc,curr) => `${acc}<td>${curr}</td>` , '')}</tr>`)
    .join('')

const datify = dateStr => {
  const [y,m,d] = dateStr.format(`YYYY-M-D`).split(`-`)
  return `new Date(${y}, ${m - 1}, ${d},`
}


const daysToMilliseconds = days =>
  days * 24 * 60 * 60 * 1000


const perc = number =>
  `${Math.floor(number * 100)}%`


const duration = (opti, pessi) =>
  `${opti} - ${pessi} wd`


const output = ({ config, graph }) => {
  const sortedNodes = graphlib.alg.topsort(graph)
  const dat = {
    optimistic: [],
    pessimistic: [],
  }
  const finish = {}
  const staff = {}
  Object.keys(config.staff).forEach(staffKey => {
    staff[staffKey] = {
      ...config.staff[staffKey],
      optimistic: 0,
      pessimistic: 0,
    }
  })
  const tasks = []

  for (const oppe of ['optimistic', 'pessimistic']) {
    for (const nodeKey of sortedNodes) {
      const node = graph.node(nodeKey)
      const startDateObj = `${datify(node.dates[oppe].start)} 0, 0)`
      const finishDateObj = `${datify(node.dates[oppe].finish)} 23, 59)`
      //const daysInMs = daysToMilliseconds(node.task[oppe]) // not displaying correctly
      finish[oppe] = node.dates[oppe].finish.isAfter(finish[oppe])
        ? node.dates[oppe].finish
        : finish[oppe]
      staff[node.task.staff][oppe] += node.task[oppe]
      if(oppe == 'optimistic') {
        const opti = node.task.optimistic
        const pessi = node.task.pessimistic
        const absVar = pessi - opti
        const relVar = (pessi - opti) / pessi
        tasks.push([absVar, relVar, node.task.title, duration(opti, pessi), staff[node.task.staff].name, node.task.note || ''])
      }
      dat[oppe].push(`['${nodeKey}', '${node.task.title}', '${node.task.staff}', ${startDateObj}, ${finishDateObj}, 0, ${node.task.complete || 0}, '${graph.predecessors(nodeKey).toString(',')}']`)
    }
    dat[oppe] = `[${dat[oppe].join(', ')}]`
  }

  return html({
    title: config.title,
    creationTime: DateTime.local().toFormat(`d MMM yyyy H:MM`),
    numRows: sortedNodes.length,
    optimistic: dat.optimistic,
    pessimistic: dat.pessimistic,
    optiFinish: finish.optimistic.format(`D MMM YYYY`),
    pessiFinish: finish.pessimistic.format(`D MMM YYYY`),
    tasksMaxAbsVar: rowify(tasks
      .map(([absVar, relVar, ...rest]) => ([absVar, ...rest]))
      .sort((a, b) => b[0] - a[0])
      .slice(0,5)
      .map(([absVar, ...rest]) => ([`${absVar} wd`, ...rest]))),
    tasksMaxRelVar: rowify(tasks
      .map(([absVar, relVar, ...rest]) => ([relVar, ...rest]))
      .sort((a, b) => b[0] - a[0])
      .slice(0,5)
      .map(([relVar, ...rest]) => ([perc(relVar), ...rest]))),
    staffTotal: Object.keys(staff).length,
    staffRows: rowify(Object.values(staff)
      .sort((a, b) => b.optimistic - a.optimistic)
      .map(({ name, optimistic, pessimistic, commitment, note }) =>
        ([ name, duration(optimistic, pessimistic), perc(commitment), note || '']))),
  })
}

module.exports = output
