var colors = ['#0C0', '#CC0', '#C00'];

angular.module('app')
  .service('GradientService', ['d3', function(d3) {
    function gradient(min, max) {
      return d3.scale.linear()
        .domain([0, max / 2, max])
        .range(colors);
    }

    function value(min, max, color) {
      return gradient(min, max)(color);
    }

    return {
      gradient: gradient,
      value: value,
      setColors: function(newColors) {
        colors = newColors;
      }
    };
  }]);
