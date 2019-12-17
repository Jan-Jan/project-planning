const graphlib = require('graphlib')


const html = (numRows, optimistic, pessimistic) => `<html>
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
  <h2>Optimistic</h2>
  <div id="graph_opti"></div>
  <h2>Pessimistic</h2>
  <div id="graph_pessi"></div>
</body>
</html>
`

const datify = dateStr => {
  const [y,m,d] = dateStr.format(`YYYY-M-D`).split(`-`)
  return `new Date(${y}, ${m - 1}, ${d},`
}


const daysToMilliseconds = days =>
  days * 24 * 60 * 60 * 1000

const output = graph => {
  const sortedNodes = graphlib.alg.topsort(graph)
  const dat = {
    optimistic: [],
    pessimistic: [],
  }

  for (const oppe of ['optimistic', 'pessimistic']) {
    for (const nodeKey of sortedNodes) {
      const node = graph.node(nodeKey)
      dat[oppe].push(`['${nodeKey}', '${node.task.title}', '${node.task.staff}', ${datify(node.dates[oppe].start)} 0, 0), ${datify(node.dates[oppe].finish)} 23, 59), ${daysToMilliseconds(node.task[oppe])}, ${node.task.complete || 0}, '${graph.predecessors(nodeKey).toString(',')}']`)
    }
    dat[oppe] = `[${dat[oppe].join(', ')}]`
  }
  return html(sortedNodes.length, dat.optimistic, dat.pessimistic)
}

module.exports = output
