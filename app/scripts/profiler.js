/* global $, window, document */

angular
  .module('profile-view', ['app'])
  .value('name', 'Profile view')
  .value('group', 'Profile views')
  .value('markedCb', markedCb)
  .value('focusCb', focusCb)
  .value('hoverCb', hoverCb)
  .service('render', render);

// handle marked event
function markedCb() {

}

// handle focus event
function focusCb() {

}

// handle hover event
function hoverCb() {

}

// inject view dependencies
render.$inject = [
  'd3',
  'profilerDataHelper',
  'profilerViewHelper',
  'SizeService',
  'GradientService'
];

// render the view
function render(d3, pdh, pvh, size, grad) {
  return function(svg, stateManager) {
    var viewMode = 'T'; // valid values T = tracing, P = profiling
    var initTracingMode = true; // checks if tracing view has been loaded before
    var initProfilingMode = false; // checks if profiling view has been loaded before
    var mainDuration = null; // runtime of main function
    var mainCallId = null; // ID of main function
    var mainCallGroupId = null; // callGroup ID of main
    var runtimeThreshold = null; // minimum runtime required for children to load
    var thresholdFactor = 1; // % of runtime required for children to load
    var tracingData = {}; // data object for tracing view
    var profilingData = {}; // data object for profiling view
    var viewData = {}; // store the current data used to display profiler
    var callHistory = []; // stores id's of calls that have been retrieved
    var callGroupHistory = []; // stores id's of call groups that have been retrieved
    var rectHeight = 22; // height of the bars in the profiler
    var textPadY = 15; // top padding for the text svg
    var textPadX = 0.5; // left padding for the text svg
    var adjustLevel = 0; // stores level -1 of bar at the top position of the profiler
    var transTime = 600; // transition time for appending a bar to profiler
    var transType = 'elastic'; // type of append transition
    var maxLevel = 1; // current highest level of bars on the profiler
    var svgWidth = '100%'; // width of the svg
    var svgElem = null; // reference to svg element
    var svgParentElem = null; // reference to svg's parent element
    var profileId = null; // random ID to differentiate profiling views on DOM
    var initView = false; // flag to check if view has been initialized before
    var partition = null; // holds modified d3 partition value function
    var zoomId = null; // id of call or callGroup that is currently zoomed to top
    var zoomHistory = []; // stores previously zoomed nodes
    var selectedTracingNodes = []; // stores selected nodes for tracing
    var selectedProfilingNodes = []; // stores selected nodes for profiling
    var minTooltipWidth = 150; // minimun width of the tooltip
    var gradient = null; // holds gradient function
    var widthScale = null; // holds function to calculate width of call
    var xScale = null; // holds function to calculate x position of call
    var clickCount = 0; // click counter for determining double or single click
    var clickData = null; // clicked node data
    var clickThis = null; // reference to the 'this' for the clicked node
    var zoomTracingId = null; // hold value of zoomId in trace view on mode switch
    var zoomProfilingId = null; // hold value of zoomId in profiling view on mode switch
    var zoomTracingHistory = []; // hold trace view zoom history on mode switch
    var zoomProfilingHistory = []; // hold profiling view zoom history on mode switch
    var zoomTracingAdjustment = 0; // "adjustLevel" value for tracing on mode switch
    var zoomProfilingAdjustment = 0; // "adjustLevel" value for profiling on mode switch
    var zoomTracingMaxLevel = 1; // "maxLevel" value for tracing on mode switch
    var zoomProfilingMaxLevel = 1; // "maxLevel" value for profiling on mode switch

    function init() {
      // get "main" function data
      pdh.getMain().then(function(call) {
        mainDuration = call.duration;
        mainCallId = call.id;
        mainCallGroupId = call.callGroupID;
        loadView();
      });
    }

    function setRuntimeThreshold(runtime) {
      runtimeThreshold = Math.ceil(runtime * (thresholdFactor / 100));
    }

    function isTracing() {
      return viewMode === 'T';
    }

    function toggleViewMode() {
      // store some variables for use when returning back to the 
      // view we are toggling out of
      if (isTracing()) {
        zoomTracingId = zoomId;
        zoomTracingHistory = zoomHistory;
        zoomTracingAdjustment = adjustLevel;
        zoomTracingMaxLevel = maxLevel;
      } else {
        zoomProfilingId = zoomId;
        zoomProfilingHistory = zoomHistory;
        zoomProfilingAdjustment = adjustLevel;
        zoomProfilingMaxLevel = maxLevel;
      }

      // change view mode
      viewMode = viewMode === 'T' ? 'P' : 'T';

      // set values for variables used in view we are toggling into
      // if the variables had a previously saved value, retrieve them.
      if (isTracing()) {
        zoomId = zoomTracingId === null ? mainCallId : zoomTracingId;
        zoomHistory = zoomTracingHistory.length === 0 ? [] : zoomTracingHistory;
        adjustLevel = zoomTracingAdjustment > 0 ? zoomTracingAdjustment : 0;
        maxLevel = zoomTracingMaxLevel > 1 ? zoomTracingMaxLevel : 1;

        if (initTracingMode) {
          displayView();
        } else {
          zoomId = null;
          loadView();
          initTracingMode = true;
        }
      } else {
        zoomId = zoomProfilingId === null ? mainCallGroupId : zoomProfilingId;
        zoomHistory = zoomProfilingHistory.length === 0 ? [] : zoomProfilingHistory;
        adjustLevel = zoomProfilingAdjustment > 0 ? zoomProfilingAdjustment : 0;
        maxLevel = zoomProfilingMaxLevel > 1 ? zoomProfilingMaxLevel : 1;

        if (initProfilingMode) {
          displayView();
        } else {
          zoomId = null;
          loadView();
          initProfilingMode = true;
        }
      }

      // update toggle button
      var state = !isTracing() ? 'Tracing' : 'Profiling';
      $('#profiler-view-toggle').text('Switch to ' + state);
    }

    // load view depending on current view mode
    function loadView() {
      var ids = isTracing() ? [mainCallId] : [mainCallGroupId];
      var ancestor = 'null';
      var level = 1;
      setRuntimeThreshold(mainDuration);
      getViewData(ids, ancestor, level);
    }

    function getViewData(ids, ancestor, level) {
      // get remote data
      pdh.getViewData(ids, ancestor, level, viewMode)
        .then(function(data) {
          for (var i = 0, len = data.length; i < len; i++) {
            var obj = data[i];

            // skip calls with runtime lesser than runtimeThreshold
            if (obj.duration < runtimeThreshold) {
              continue;
            }

            // add call ids' to history
            if (isTracing()) {
              callHistory.push(obj.id);
            } else {
              callGroupHistory.push(obj.id);
            }

            // append object to tracing or profiling parent object
            buildViewData(obj);

            // call getViewData on children of obj
            loadChildren(obj.id, obj.calls, level);

            // update the display
            displayView();
          }
        });
    }

    function loadChildren(id, calls, level) {
      var children = [];
      var history = isTracing() ? callHistory : callGroupHistory;
      _.map(calls, function(x) {
        if (history.indexOf(x) === -1) {
          children.push(x);
        }
      });

      if (children.length > 0) {
        getViewData(children, id, level + 1);
      }
    }

    // add an object to the children element of tracing or profiling data
    // obj parameter can either be call or callGroup data
    function buildViewData(obj) {
      if (obj.ancestor === 'null') {
        if (isTracing()) {
          tracingData = obj;
        } else {
          obj.start = 0;
          obj.end = obj.duration;
          profilingData = obj;
        }
      } else {
        if (isTracing()) {
          pvh.appendDeep(tracingData, obj, isTracing());
        } else {
          pvh.appendDeep(profilingData, obj, isTracing());
        }
      }
    }

    // build the profiling or tracing svg, and display it
    function displayView() {
      // initialize some view variables if uninitialized
      if (initView === false) {
        initView = true;
        profileId = Date.now();
        svg.attr('id', profileId);
        svgElem = document.getElementById(profileId);
        svgParentElem = document.getElementById(profileId).parentNode;
        gradient = grad.gradient(0, mainDuration);
        partition = d3.layout.partition().value(function(d) {
          return d.duration;
        });
      }

      if (zoomId !== null) {
        // if we're zooming, retrieve zoomed sub section of view data
        viewData = isTracing() ?
        pvh.findDeep(tracingData, zoomId) : pvh.findDeep(profilingData, zoomId);
      } else {
        viewData = isTracing() ? tracingData : profilingData;
      }

      // partition view data using d3's parition layout function
      var nodes = partition.nodes(viewData);

      // define scale for width values
      widthScale = d3.scale.linear()
        .domain([0, nodes[0].duration])
        .range([0, svgWidth]);

      // define scale for x coordinate values
      xScale = d3.scale.linear()
        .domain([nodes[0].start, nodes[0].end])
        .range([0, svgWidth]);

      // remove any child elements of svg
      svg.selectAll('*').remove();

      // draw rect svg elements using data
      drawRectSvg(svg.selectAll('rect'), nodes);

      // draw text svg elements using data
      drawTextSvg(svg.selectAll('text'), nodes);

      // set click/dblClick handlers for rect and text
      svgClickHander(svg.selectAll('rect, text'));

      // adjust svg height, so scrollbars appear if any
      var newSvgHeight = rectHeight * (maxLevel - adjustLevel);
      svg.style('height', newSvgHeight + 'px');

      // if we are zooming a node to top
      if (zoomId !== null) {
        drawRectSvgZoom(svg.selectAll('rect'));
        drawTextSvgZoom(svg.selectAll('text'));
      }

      // highlight selected nodes if any are present
      if (isTracing()) {
        if (selectedTracingNodes.length > 0) {
          displaySelectedNodes(svg.selectAll('rect'));
        }
      } else {
        if (selectedProfilingNodes.length > 0) {
          displaySelectedNodes(svg.selectAll('rect'));
        }
      }
    }

    function svgClickHander(selection) {
      selection
        .on('click', selectNode)
        .on('mouseenter', highlightNode)
        .on('mouseleave', removeNodeHighlight);
    }

    function highlightNode(d) {
      // reduce opacity of selected call
      d3.select(this).attr('fill-opacity', 0.5);

      var x = d3.event.pageX;
      var y = d3.event.pageY;
      var duration = d.duration / mainDuration * 100;
      var svgWidthPixels = size.svgSizeById(profileId).width;
      var tooltipPadding = 20;
      var tooltipWidth = _.max([
        minTooltipWidth,
        size.textSize(d.name, 14).width
      ]);

      // show tooltip to the left of the mouse if there is not
      // enough space for it to appear on the right
      if (tooltipWidth + tooltipPadding > svgWidthPixels - x) {
        x = x - (tooltipWidth + tooltipPadding);
      }

      // update the tooltip position and value
      var tooltip = d3.select('#tooltip')
        .style('left', x  + 'px')
        .style('top', y + 'px')
        .style('width', tooltipWidth + 'px');
      tooltip
        .select('#title')
        .text(d.name);
      tooltip
        .select('#value')
        .text(duration.toFixed(2) + ' %');

      // show the tooltip
      tooltip.classed('hidden', false);

      // broadcast hover action through state manager
      var hoverType = isTracing() ? 'Call' : 'CallGroup';
      stateManager.hover([{type: hoverType, id: d.id}]);
    }

    function removeNodeHighlight() {
      // set selected call's opacity back to 100%
      d3.select(this).attr('fill-opacity', 1);

      // hide the tooltip
      d3.select('#tooltip').classed('hidden', true);
    }

    function selectNode(d) {
      clickThis = this;
      clickData = d;
      clickCount++;

      // evaluate click count after defined time
      window.setTimeout(function() {
        // for two clicks, zoom to node
        if (clickCount === 2) {
          zoom(clickData);
        }

        // for one click, select node
        if (clickCount === 1) {
          setSelectedNodes(clickData, clickThis);
        }

        // reset click counter
        clickCount = 0;
      }, 300);
    }

    function setSelectedNodes(d, obj) {
      var node;
      var rectSelect = d3.select(obj);
      var selectedNodes = isTracing() ?
      selectedTracingNodes : selectedProfilingNodes;

      if (!rectSelect.empty()) {
        if (rectSelect.attr('prev-color') === null) {
          var currentColor = rectSelect.attr('fill');
          rectSelect
            .attr('prev-color', currentColor)
            .attr('fill', 'grey')
            .attr('fill-opacity', 0.8);

          // add node to selection
          node = _.findWhere(selectedNodes, {id: d.id});
          if (node === undefined) {
            if (isTracing()) {
              selectedTracingNodes.push({
                type: 'Call',
                id: d.id,
                isMarked: true
              });
            } else {
              selectedProfilingNodes.push({
                type: 'CallGroup',
                id: d.id,
                isMarked: true
              });
            }
          }
        } else {
          var prevColor = rectSelect.attr('prev-color');
          rectSelect.attr('prev-color', null);
          rectSelect.attr('fill', prevColor);

          // remove node from selection
          node = _.findWhere(selectedNodes, {id: d.id});
          if (node !== undefined) {
            if (isTracing()) {
              selectedTracingNodes.splice(selectedNodes.indexOf(node), 1);
            } else {
              selectedProfilingNodes.splice(selectedNodes.indexOf(node), 1);
            }
          }
        }
      }
    }

    function displaySelectedNodes(selection) {
      var selectedNodes = isTracing() ?
      selectedTracingNodes : selectedProfilingNodes;

      selection
        .each(function(d) {
          var selected = d3.select(this);
          for (var i = 0, len = selectedNodes.length; i < len; i++) {
            var node = selectedNodes[i];
            if (node.id === d.id) {
              var currentColor = selected.attr('fill');
              selected
                .attr('prev-color', currentColor)
                .attr('fill', 'grey')
                .attr('fill-opacity', 0.8);
            }
          }
        });
    }

    function drawRectSvg(selection, nodes) {
      selection
        .data(nodes)
        .enter()
        .append('rect')
        .attr('stroke', 'white')
        .attr('stroke-opacity', 1)
        .attr('stroke-width', 2)
        .attr('id', function(d) {
          return d.id;
        })
        .attr('fill', function(d) {
          return gradient(d.duration);
        })
        .attr('x', function(d) {
          return xScale(d.start);
        })
        .attr('width', function(d) {
          return widthScale(d.duration);
        })
        .attr('y', function(d) {
          var y = rectHeight * (d.level - adjustLevel) - rectHeight;
          if (d.level > maxLevel) { maxLevel = d.level; }
          if (zoomId !== null) { y -= rectHeight; }
          return y;
        })
        .attr('height', function() {
          var h = rectHeight;
          if (zoomId !== null) { h = rectHeight / 2; }
          return h;
        })
        .attr('fill-opacity', function() {
          var f = 1;
          if (zoomId !== null) { f = 0; }
          return f;
        });
    }

    function drawRectSvgZoom(selection) {
      selection
        .transition()
        .duration(transTime)
        .ease(transType)
        .attr('fill-opacity', 1)
        .attr('height', function() {
          return rectHeight;
        })
        .attr('y', function(d) {
          return rectHeight * (d.level - adjustLevel) - rectHeight;
        });
    }

    function drawTextSvg(selection, nodes) {
      selection
        .data(nodes.filter(function(d) {
          // only show text for calls with widths' big enough
          // to contain the full name of the call
          var rectWidth = size.svgSizeById(d.id).width;
          var textWidth = size.svgTextSize(d.name, 14).width;
          return rectWidth > textWidth + textPadX;
        }))
        .enter()
        .append('text')
        .attr('id', function(d) { return 'text_' + d.id; })
        .attr('font-family', 'Arial')
        .attr('font-size', '14px')
        .attr('fill', 'white')
        .attr('x', function(d) {
          var old = xScale(d.start);
          var sliced = Number(old.slice(0, -1));
          var x = Number(sliced + textPadX) + '%';
          return x;
        })
        .attr('y', function(d) {
          var y = rectHeight * (d.level - adjustLevel) - rectHeight;
          y += textPadY;
          if (zoomId !== null) { y -= 50; }
          return y;
        })
        .attr('fill-opacity', function() {
          var f = 1;
          if (zoomId !== null) { f = 0; }
          return f;
        })
        .text(function(d) { return d.name; });
    }

    function drawTextSvgZoom(selection) {
      selection
        .transition()
        .duration(transTime)
        .ease(transType)
        .attr('fill-opacity', 1)
        .attr('y', function(d) {
          var y = rectHeight * (d.level - adjustLevel) - rectHeight;
          return y + textPadY;
        });
    }

    function zoom(d) {
      // clicking on current top level node
      // zoom to previous parent level
      if (zoomId === d.id) {
        zoomHistory.pop();

        if (zoomHistory.length > 0) {
          zoomToLevel(zoomHistory[zoomHistory.length - 1], false);
        } else {
          zoomToTop();
        }
        return;
      }

      // zoom to new child level
      zoomToLevel(d, true);

      // save parent level (previous location) to zoom history
      zoomHistory.push({
        level: d.level,
        id: d.id,
        duration: d.duration,
        name: d.name
      });
    }

    function zoomToLevel(d, loadNodeChildren) {
      adjustLevel = d.level - 1;
      zoomId = d.id;
      setRuntimeThreshold(d.duration);
      displayView();

      if (loadNodeChildren) {
        loadChildren(d.id, d.calls, d.level);
      }
    }

    function zoomToTop() {
      adjustLevel = 0;
      zoomId = isTracing() ? mainCallId : mainCallGroupId;
      zoomHistory = [];
      maxLevel = 1;
      setRuntimeThreshold(mainDuration);
      displayView();
    }

    window.setTimeout(function() {
      // add click handler to zoom view to top
      document.getElementById('profiler-reset')
      .addEventListener('click', function() {
        zoomToTop();
      });

      // add click handler to toggle view modes
      document.getElementById('profiler-view-toggle')
      .addEventListener('click', function() {
        toggleViewMode();
      });

      // add click handler to re-render view on window resize
      window.addEventListener('resize', function() {
        displayView();
      });
    }, 1000);

    // start the view
    init();
  };
}