/**
 * @file TaskRunner
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-task-runner
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
const Contingency = require('contingency')
const debug = require('debug')('pomegranate:taskrunner')
/**
 *
 * @module TaskRunner
 */


exports.options = {
  taskqueue: 'my.task.queue'
}
exports.metadata = {
  frameworkVersion: 6,
  name: 'MachineRunner',
  type: 'action',
  depends: ['Machines', 'RabbitConnection']
}
exports.plugin = {
  load: function(Options, PluginContext, RabbitConnection, Machines, Logger, inject, loaded) {
    // this.RabbitConnection = inject('RabbitConnection')
    // let Machines = inject('Machines')
    // let Logger = inject('Logger')
    let plugin = this
    PluginContext.TaskHandler = function(msg) {
      var self = this

      if(msg !== null) {
        let parsedMsg
        try {
          parsedMsg = JSON.parse(msg.content.toString())
          if(parsedMsg == null){
            // plugin.Logger.warn('Message string was null, discarding')
            throw new Error('Parsed Message was null.')
          }
          if(!parsedMsg.taskName){
            // plugin.Logger.warn('No taskName present, discarding')
            throw new Error('No taskName present.')
          }
        }
        catch (e) {
          Logger.warn(`Unable to parse message "${msg.content}", ${e.message}`);
          self.ack(msg)
          return
        }
        debug(parsedMsg)
        // console.log(parsedMsg);
        let correlationId = msg.properties.correlationId
        let replyTo = msg.properties.replyTo

        if(correlationId && replyTo){
          parsedMsg.RPCmetadata = {
            correlationId: correlationId,
            replyTo: replyTo
          }
        }

        let currentTaskName = parsedMsg.taskName
        let task = Machines[currentTaskName]

        if(!task) {
          Logger.warn(`Taskname -- ${currentTaskName} not found.`)
          self.ack(msg)
          return
        }

        var runTask = new Contingency(task, parsedMsg)

        runTask.on('complete', function(results) {
          let n = results.name
          let et = results.elapsedTime / 1000
          let tc = results.transitions
          plugin.Logger.log(`${results.uuid}: ${n} finished in ${et}s with ${tc} state transitions.`);
          self.ack(msg)
        })

        runTask.on('error', function(result) {
          let uuid = result.instance.uuid
          let n = result.instance.name
          let et = result.instance.elapsedTime / 1000
          let tc = result.instance.transitions
          let emsg = result.error.message
          debug(result.error)
          Logger.error(`${uuid}: ${n} encountered an unrecoverable error: ${emsg}. (In ${et}s with ${tc} state transitions)`)
          self.ack(msg)
        })

        runTask.start()
          .then(function(r) {
            Logger.log(`${r.uuid}: ${r.name} started at ${new Date(r.startTime).toISOString()}.`)
          }).catch(function(err) {
            Logger.error(err);
          })
        return
      }

      Logger.warn('Message string was null, discarding')
      self.ack(msg)

    }

    return RabbitConnection.createChannel()
      .then((channel) => {
        PluginContext.TaskChannel = channel
        channel.assertQueue(Options.taskqueue, {durable: true})
        return true
      })

  },
  start: function(Options, PluginContext) {
    var self = this

    PluginContext.TaskChannel.consume(Options.taskqueue, PluginContext.TaskHandler.bind(PluginContext.TaskChannel))

  }
}
