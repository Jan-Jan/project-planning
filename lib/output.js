const graphlib = require('graphlib')


const html = (optimistic,pessimistic) => `<html>
<head>
  <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
  <script type="text/javascript">
    google.charts.load('current', {'packages':['gantt']});
    google.charts.setOnLoadCallback(drawCharts);

    function drawChart(id, rows) {

      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Task ID');
      data.addColumn('string', 'Task Name');
      data.addColumn('date', 'Start Date');
      data.addColumn('date', 'End Date');
      data.addColumn('number', 'Duration');
      data.addColumn('number', 'Percent Complete');
      data.addColumn('string', 'Dependencies');

      data.addRows(rows);

      var options = {
        height: 275
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
  <div id="graph_opti"></div>
  <div id="graph_pessi"></div>
</body>
</html>
`

const datify = dateStr =>
  `new Date(${dateStr.format(`YYYY-M-D`).split(`-`)})`
  //`new Date(${dateStr.split('-')})`


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
      dat[oppe].push(`['${nodeKey}', '${node.task.title}', ${datify(node.dates[oppe].start)}, ${datify(node.dates[oppe].finish)}, ${daysToMilliseconds(node.task[oppe])}, ${node.task.complete || 0}, '${graph.predecessors(nodeKey).toString(',')}']`)
    }
    dat[oppe] = `[${dat[oppe].join(', ')}]`
  }
  return html(dat.optimistic, dat.pessimistic)
}

module.exports = output
