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

const util = require('magnum-plugin-utils')
const Contingency = require('contingency')
const Promise = util.bluebird
const _ = util.lodash
const path = require('path')


exports.options = {
  workDir: './Machines',
  abstractedStatesDir: './_abstractedStates'
}

exports.metadata = {
  name: 'MachineLoader',
  type: 'service',
  param: 'Machines',
  optional: ['TaskUtilities']
}

exports.plugin = {
  load: function(inject, loaded) {
    let workDir = this.options.workDir
    let abstractedStatesDir = this.options.abstractedStatesDir
    let abstractedStates  = path.join(workDir, abstractedStatesDir)

    util.fileList(abstractedStates)
      .then((files) => {
        this.Logger.log(`Loading Abstracted states from: ${abstractedStates}`)

        return Promise.map(files, (f)=>{
          let fn = require(path.join(abstractedStates, f))
          let as = inject(fn)
          this.Logger.log(`Abstracted State "${as.name}" loaded.`)
          return as
        })
      })
      .then((injectedAbstractStates) => {
        return _.keyBy(injectedAbstractStates, 'name')
      })
      .then((abstractStatesObj) => {
        return Promise.props({
          machineDirs: util.fileList(workDir, {directories: true}),
          abstractStates: abstractStatesObj
        })
      })
      .then((setup) => {

        /*
         * Remove Abstracted States directory from workdir to prevent it from attempting to load
         * it as a state machine.
         */
        _.remove(setup.machineDirs, (d) => {
          return (path.normalize(d) === path.normalize(abstractedStatesDir));
        })

        return Promise.map(setup.machineDirs, (dir) => {

          var thisMachine = path.join(workDir, dir)

          let MachineConfig = require(thisMachine)

          /*
           Set the search path for individual states from the state index.js file.
           */
          let machineStatesDir = MachineConfig.statesDir || './states'

          let thisMachineStates = path.join(thisMachine, machineStatesDir)

          return util.fileList(thisMachineStates)
            .then((files) => {

              let ReadyMachine = require(thisMachine)
              console.log(ReadyMachine);
              let absStates = ReadyMachine.abstractedStates || []

              /*
               * Run our states through the injector, the returned object has its state name.
               * Match the state name against the array of abstracted states, and replace with the
               * global version if both are present.
               */
              let injectedStates = _.map(files, (file)=> {
                let i = inject(require(path.join(thisMachineStates, file)))
                let replacer = setup.abstractStates[i.name]
                if(_.isObject(replacer)){
                  this.Logger.warn(`${ReadyMachine.name}, local state "${i.name}" present, being replaced by abstracted state based on config.`)
                  return replacer
                }
                return i
              })

              /*
               * Include any missing states from the abstracted states object, throw if requested
               * abstracted state is missing.
               */
              if(absStates.length){
                let tmp = _.map(absStates, n => ({name: n}) )
                let neededAbstractedStates = _.differenceBy(tmp, injectedStates, 'name')

                _.each(neededAbstractedStates, (s) => {
                  let include = setup.abstractStates[s.name]
                  if(_.isObject(include)){
                    this.Logger.log(`${ReadyMachine.name} using abstracted state "${s.name}".`)
                    injectedStates.push(include)
                  } else {
                    throw new Error(`Abstracted state "${s.name}" missing but required by ${ReadyMachine.name}`)
                  }
                })
              }


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
      .catch((err) => {
        loaded(err)
      })

  },
  start: function(done) {
    done()
  },
  stop: function(done) {
    done()
  }
}
