// everything that has to do with loading data from the database

angular
  .module('app')
  .factory('pData', pData);

// inject dependencies
pData.$inject = ['LoaderService'];

function pData(LoaderService) {
  var factory = {
    getMain: getMain,
    getRecursive: getRecursive,
    getCall: getCall,
    getCallGroup: getCallGroup,
    getCallObj: getCallObj,
    getCallGroupObj: getCallGroupObj,
    getThreadData: getThreadData
  };

  return factory;

  // get call data for "main"
  function getMain() {
    var promise = LoaderService.getFunctionBySignature('main')
      .then(function(func) {
        return func.getCalls();
      })
      .then(function(call) {
        return new RSVP.resolve(call[0]);
      });
    return promise;
  }

  // recursively get all children of an object that have duration
  // >= a certain threshold
  function getRecursive(obj, isTracing, runtimeThreshold, level) {
    var type = isTracing ? 'call' : 'callgroup';
    var ancestor = isTracing ? 'callerID' : 'parentID';
    var func = isTracing
      ? obj.getRecursiveCalls(runtimeThreshold)
      : obj.getRecursiveCallGroups(runtimeThreshold);

    var promise = func.then(function(data) {
      console.log(data);
      
      var promises = data.map(function(d) {
        var _id = d[type].id;
        var _ancestor = d[type][ancestor];
        var _level = d.depth + level;

        var dataFunc = isTracing
          ? getCallObj(_id, _ancestor, _level)
          : getCallGroupObj(_id, _ancestor, _level);

        return dataFunc;
      });

      return RSVP.all(promises);
    })
    .then(function(children) {
      if (!isTracing) {
        // sort for callgroup case. callgroup should be ordered in ascending 
        // order of level, and descending order of duration
        children = _.sortByOrder(children, ['level', 'duration'], [true, false]);
      } 

      return new RSVP.resolve(children);
    });
    return promise;
  }

  // get an call data by call id
  function getCall(id) {
    return LoaderService.getCall(id);
  }

  // get callgroup data by callgroup id
  function getCallGroup(id) {
    return LoaderService.getCallGroup(id);
  }

  // get a call id custom call object. the object that is returned has 
  // selected properties of the related call, function, and loop data (if any)
  function getCallObj(id, ancestor, level) {
    var self;
    var temp = {};

    var promise = LoaderService.getCall(id)
      .then(function(call) {
        self = call;
        temp.start = Number(call.start);
        temp.end = Number(call.end);
        temp.duration = call.duration;
        temp.ancestor = ancestor;
        temp.level = level;
        temp.id = call.id;
        temp.hasLoops = call.loopCount > 0 ? true : false;
        temp.loopAdjust = 0;
        temp.loopIterationCount = 0;
        temp.loopDuration = 0;
        temp.loopStart = undefined;
        temp.loopEnd = undefined;
        temp.loopIterationCalls = [];

        return call.getFunction();
      })
      .then(function(func) {
        temp.name = func.signature;

        return self.getDirectLoopExecutions();
      })
      .then(function(execution) {
        if (execution.length > 0) {
          temp.loopIterationCount = execution[0].iterationsCount;
          temp.loopDuration = execution[0].duration;
          temp.loopStart = execution[0].start;
          temp.loopEnd = execution[0].end;
          return execution[0].getLoopIterations();
        }        
      })
      .then(function(iteration) {
        if (iteration !== undefined) {
          var promises = iteration.map(function(i){ 
            return i.getCalls(); 
          });
          return RSVP.all(promises);
        }
      })
      .then(function(calls) {
        _.forEach(calls, function(c) {
          // some calls being pushed here are empty objects
          // because the iteration did not make any call
          temp.loopIterationCalls.push(c[0]);
        });

        return new RSVP.resolve(temp);
      });
    return promise;
  }

  // get a callgroup id custom callgroup object
  function getCallGroupObj(id, ancestor, level) {
    var temp = {};
    var promise = LoaderService.getCallGroup(id)
      .then(function(callGroup) {
        temp.start = 0;
        temp.end = callGroup.duration;
        temp.duration = callGroup.duration;
        temp.ancestor = ancestor;
        temp.level = level;
        temp.id = callGroup.id;

        return callGroup.getFunction();
      })
      .then(function(func) {
        temp.name = func.signature;

        return new RSVP.resolve(temp);
      });
    return promise;
  }

  // get thread data (sample)
  function getThreadData() {
    return new Promise(function(resolve, reject) {
      resolve([
        {id: 1, name: 'Thread 1', ancestor: null},
        {id: 2, name: 'Thread 2', ancestor: 1},
        {id: 3, name: 'Thread 3', ancestor: 1},
        {id: 4, name: 'Thread 4', ancestor: 3},
        {id: 5, name: 'Thread 5', ancestor: 3},
        {id: 6, name: 'Thread 6', ancestor: 2}
      ]);
    });
  }
}
