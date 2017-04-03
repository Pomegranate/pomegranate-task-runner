/**
 * @file MachineLoader
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-task-runner
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';

/**
 * Loads Contingency state machines.
 * @module MachineLoader
 */

/**
 * Created by monstertke on 7/25/16.
 */

"use strict";

var util = require('magnum-plugin-utils')
var Contingency = require('contingency')
var Promise = util.bluebird
var _ = util.lodash
var path = require('path')


exports.options = {
  workDir: './Machines',
  statesDir: './states',
}

exports.metadata = {
  name: 'MachineLoader',
  type: 'service',
  param: 'Machines'
}

exports.plugin = {
  load: function(inject, loaded) {
    var workDir = this.options.workDir
    var statesDir = this.options.statesDir

    util.fileList(workDir, {directories: true})
      .then(function(dirs) {

        return Promise.map(dirs, function(dir) {
          var thisMachine = path.join(workDir, dir)
          var thisMachineStates = path.join(thisMachine, statesDir)
          return util.fileList(thisMachineStates)
            .then(function(files) {
              var injectedStates = _.map(files, function(file) {
                return inject(require(path.join(thisMachineStates, file)))
              })
              var ReadyMachine = require(thisMachine)
              ReadyMachine.states = injectedStates
              return ReadyMachine
            })
        })

      })
      .then((loadedStateMachines) => {
        var keyed = _.keyBy(loadedStateMachines, 'name')

        Object.keys(keyed).forEach((k) => {
          this.Logger.log(`${k} machine ready.`)
        })

        loaded(null, keyed)
      })

  },
  start: function(done) {
    done()
  },
  stop: function(done) {
    done()
  }
}

// module.exports = [
//   {
//     options: {
//       workDir: './Machines',
//       statesDir: './states',
//     },
//     metadata: {
//       name: 'MachineLoader',
//       type: 'service',
//       param: 'Machines',
//       depends: ['Endpoints'],
//       provides: ['RabbitmqTasks']
//     },
//     plugin: {
//       load: function(inject, loaded) {
//         var workDir = this.options.workDir
//         var statesDir = this.options.statesDir
//
//         util.fileList(workDir, {directories: true})
//           .then(function(dirs){
//
//             return Promise.map(dirs, function(dir) {
//               var thisMachine = path.join(workDir, dir)
//               var thisMachineStates = path.join(thisMachine, statesDir)
//               return util.fileList(thisMachineStates)
//                 .then(function(files){
//                   var injectedStates = _.map(files, function(file){
//                     return inject(require(path.join(thisMachineStates, file)))
//                   })
//                   var ReadyMachine = require(thisMachine)
//                   ReadyMachine.states = injectedStates
//                   return ReadyMachine
//                 })
//             })
//
//           })
//           .then(function(loadedStateMachines){
//             var keyed = _.keyBy(loadedStateMachines, 'name')
//             loaded(null, keyed)
//           })
//
//       },
//       start: function(done) {
//         done()
//       },
//       stop: function(done) {
//         done()
//       }
//     }
//   },
//   {
//     options: {
//       limit: 200,
//       workqueue: 'workqueue',
//       prefetch: 10
//     },
//     metadata:{
//       name: 'MachineRunner',
//       type: 'action',
//       depends: ['Machines', 'Rabbit']
//     },
//     plugin: {
//     load: function(inject, loaded) {
//       this.Rabbit = inject('Rabbit')
//       this.Machines = inject('Machines')
//       this.Manager = this.Rabbit.socket('WORKER')
//       this.Manager.setsockopt('prefetch', parseInt(this.options.prefetch))
//       this.Manager.setEncoding('utf-8')
//
//       this.Logger.log('Setting prefetch limit to ' + this.options.prefetch)
//       loaded(null, null)
//     },
//     start: function(done) {
//       var self = this
//
//       this.Manager.connect(self.options.workqueue, function(){
//         self.Logger.log('Connected to queue ' + self.options.workqueue)
//         self.Logger.log('Waiting for tasks...')
//         self.Manager.on('data', function(data){
//           try{
//             var d = JSON.parse(data)
//           }
//           catch(err) {
//             self.Logger.error(err)
//           }
//           if(!d) {
//             return self.Manager.ack()
//           }
//           var task = d.taskName
//
//           task = self.Machines[task]
//
//           if(!task){
//             self.Logger.warn(`Taskname -- ${d.taskName} not found.`)
//             self.Manager.ack()
//             return
//           }
//
//           var runTask = new Contingency(task, d)
//
//           runTask.on('complete', function(results) {
//             let n = results.name
//             let et = results.elapsedTime / 1000
//             let tc = results.transitions
//             self.Logger.log(`Finished ${n} in ${et}s with ${tc} state transitions.`);
//             self.Manager.ack()
//           })
//
//           runTask.on('error', function(err){
//             self.Logger.error(err)
//             self.Logger.error('There has been an error processing this task.')
//             self.Manager.discard()
//           })
//
//           runTask.start().then(function(result) {
//           }).catch(function(err) {
//             console.log(err);
//           })
//         })
//
//         done(null)
//       })
//     },
//     stop: function(done) {
//       done()
//     }
//   }
//   }
// ]
