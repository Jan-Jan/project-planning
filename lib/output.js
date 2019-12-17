const graphlib = require('graphlib')


const html = ({
  title,
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
</head>
<body>
  <h1>${title}</h1>

  <h2>Optimistic (by ${optiFinish})</h2>
  <div id="graph_opti"></div>

  <h2>Pessimistic (by ${optiFinish})</h2>
  <div id="graph_pessi"></div>

  <h2>Risks</h2>

  <h3>Tasks with greatest absolute variance</h3>
  ${tasksMaxAbsVar}

  <h3>Tasks with greatest relative variance</h3>
  ${tasksMaxRelVar}

  <h2>${staffTotal} x Staff</h2>
  ${staffRows}
</body>
</html>
`

const datify = dateStr => {
  const [y,m,d] = dateStr.format(`YYYY-M-D`).split(`-`)
  return `new Date(${y}, ${m - 1}, ${d},`
}


const daysToMilliseconds = days =>
  days * 24 * 60 * 60 * 1000

const output = ({ config, graph }) => {
  const sortedNodes = graphlib.alg.topsort(graph)
  const dat = {
    optimistic: [],
    pessimistic: [],
  }

  for (const oppe of ['optimistic', 'pessimistic']) {
    for (const nodeKey of sortedNodes) {
      const node = graph.node(nodeKey)
      const startDateObj = `${datify(node.dates[oppe].start)} 0, 0)`
      const finishDateObj = `${datify(node.dates[oppe].finish)} 23, 59)`
      const daysInMs = daysToMilliseconds(node.task[oppe])
      dat[oppe].push(`['${nodeKey}', '${node.task.title}', '${node.task.staff}', ${startDateObj}, ${finishDateObj}, 0, ${node.task.complete || 0}, '${graph.predecessors(nodeKey).toString(',')}']`)
    }
    dat[oppe] = `[${dat[oppe].join(', ')}]`
  }
  return html({
    title: config.title,
    numRows: sortedNodes.length,
    optimistic: dat.optimistic,
    pessimistic: dat.pessimistic,
  })
}

module.exports = output
