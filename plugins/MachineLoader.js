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
