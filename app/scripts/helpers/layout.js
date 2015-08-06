angular.module('app')
  .service('LayoutCallGraphService',
  ['sizeHelper', 'dagre',
function(sizeHelper, dagre) {
  var conf = {
    horisontalMargin: 5,
    verticalMargin: 0
  };

  function clearLayout(graph) {
    _.chain(graph.nodes())
      .map(function(node) {
        return graph.node(node);
      })
      .forEach(function(node) {
        delete node.x;
        delete node.y;
        delete node.rank;
        delete node.maxSequence;
      })
      .value();

    var g = graph.graph();

    delete g.rank;
  }

  function rankCalls(graph) {
    var roots =
      _.chain(graph.sources())
        .map(function(node) {
          return graph.node(node);
        })
        .filter(function(node) {
          return node.isCall;
        })
        .value();

    var rank = [roots];

    var index = 0;
    var i;
    var j;

    while (true) {
      var last = rank[index];
      var current = [];

      for (i = 0; i < last.length; i++) {
        var successors = graph.successors(last[i].id);

        for (j = 0; j < successors.length; j++) {
          var node = graph.node(successors[j]);

          if (node.isCall) {
            current.push(node);
          }
        }
      }

      index++;

      if (current.length > 0) {
        rank.push(current);
      } else {
        break;
      }
    }

    for (i = 0; i < rank.length; i++) {
      var line = rank[i];

      for (j = 0; j < line.length; j++) {
        line[j].rank = i;
      }
    }

    graph.graph().rank = rank;
  }

  function calcMaxSequence(graph) {
    var i;
    var j;

    var current = graph.sinks();
    var next = [];

    for (i = 0; i < current.length; i++) {
      var node = graph.node(current[i]);
      if (node.isCall) {
        next.push(current[i]);
      } else if (node.isReference) {
        var scall = graph.predecessors(current[i]);
        for (j = 0; j < scall.length; j++) {
          if (graph.node(scall[j]).isCall && next.indexOf(scall[j]) === -1) {
            next.push(scall[j]);
          }
        }
      }
    }

    current = next;

    var at = 0;
    do {
      next = [];

      for (i = 0; i < current.length; i++) {
        graph.node(current[i]).maxSequence = at;

        var pred = graph.predecessors(current[i]);

        for (j = 0; j < pred.length; j++) {
          if (graph.node(pred[j]).isCall && next.indexOf(pred[j]) === -1) {
            next.push(pred[j]);
          }
        }
      }

      at++;
      current = next;
    } while (current.length > 0);
  }

  function maxWidth(nodes) {
    var max = nodes[0].width;

    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].width > max) {
        max = nodes[i].width;
      }
    }

    return max;
  }

  function layoutCalls(graph) {
    var i;
    var j;

    var x = 0;
    var y = 0;

    var rank = graph.graph().rank;

    function sortByMaxSequence(a, b) {
      return a.maxSequence < b.maxSequence;
    }

    for (i = 0; i < rank.length; i++) {
      rank[i].sort(sortByMaxSequence);
    }

    for (i = 0; i < rank.length; i++) {
      var width = maxWidth(rank[i]);

      y = 0;
      for (j = 0; j < rank[i].length; j++) {
        rank[i][j].x = x;
        rank[i][j].y = y;

        if (y >= 0) {
          y += rank[i][j].height + conf.verticalMargin;
        } else {
          y -= rank[i][j].height + conf.verticalMargin;
        }

        y = -y;
      }

      x += width + conf.horisontalMargin;
    }
  }

  function layout(graph) {
    clearLayout(graph);
    rankCalls(graph);
    calcMaxSequence(graph);
    layoutCalls(graph);
  }

  function groupRefs(graph, ret) {
    var groups = [];

    function addToGroup(node) {
      var group = _.find(groups, function(group) {
        return _.isEqual(group.inbound, graph.predecessors(node.id));
      });

      if (group) {
        group.elements.push(node);
      } else {
        group = {
          isGroup: true,
          elements: [node],
          inbound: graph.predecessors(node.id),
          id: 'group:ref:' + groups.length,
          label: 'Grouped references',
          height: 50,
          width: 150
        };

        groups.push(group);
      }
    }

    _.chain(graph.nodes())
      .map(function(node) {
        return graph.node(node);
      })
      .filter(function(node) {
        return node.isReference;
      })
      .forEach(function(node) {
        addToGroup(node);
      })
      .value();

    _.forEach(groups, function(group) {
      if (group.elements.length > 1) {
        ret.setNode(group.id, group);
      } else {
        ret.setNode(group.elements[0].id, group.elements[0]);
      }

    });

    ret.graph().refGroups = groups;
  }

  function groupCalls(graph, ret) {
    _.chain(graph.nodes())
      .map(function(node) {
        return graph.node(node);
      })
      .filter(function(node) {
        return node.isCall;
      })
      .forEach(function(node) {
        ret.setNode(node.id, node);
      })
      .value();
  }

  function addEdges(graph, ret) {
    var groups = ret.graph().refGroups;

    _.forEach(groups, function(group) {
      if (group.elements.length > 1) {
        var preds = group.inbound;

        for (var i = 0; i < preds.length; i++) {
          ret.setEdge(preds[i], group.id, {});
        }
      }
    });

    _.chain(ret.nodes())
      .map(function(node) {
        return ret.node(node);
      })
      .filter(function(node) {
        return node.isReference || node.isCall;
      })
      .forEach(function(node) {
        var preds = graph.predecessors(node.id);

        for (var i = 0; i < preds.length; i++) {
          ret.setEdge(preds[i], node.id, graph.edge(preds[i], node.id));
        }
      })
      .value();
  }

  function group(graph) {
    var ret = new dagre.graphlib.Graph({
      directed: true
    });

    ret.setGraph(graph.graph());

    groupRefs(graph, ret);
    groupCalls(graph, ret);
    addEdges(graph, ret);

    return ret;
  }

  return {
    layout: layout,
    group: group
  };

}]);
