/**
 * @file TaskRunner
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-task-runner
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
const Contingency = require('contingency')
/**
 *
 * @module TaskRunner
 */


exports.options = {
  taskqueue: 'taskqueue'
}
exports.metadata = {
  name: 'MachineRunner',
  type: 'action',
  depends: ['Machines', 'RabbitConnection']
}
exports.plugin = {
  load: function(inject, loaded) {
    this.RabbitConnection = inject('RabbitConnection')
    let Machines = inject('Machines')
    let Logger = inject('Logger')
    let plugin = this
    this.TaskHandler = function(msg) {
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
          plugin.Logger.warn(`Unable to parse message "${msg.content}", ${e.message}`);
          self.ack(msg)
          return
        }

        let currentTaskName = parsedMsg.taskName

        let task = Machines[currentTaskName]

        if(!task) {
          plugin.Logger.warn(`Taskname -- ${currentTaskName} not found.`)
          self.ack(msg)
          return
        }

        var runTask = new Contingency(task, parsedMsg)

        runTask.on('complete', function(results) {
          let n = results.name
          let et = results.elapsedTime / 1000
          let tc = results.transitions
          plugin.Logger.log(`Finished ${n} in ${et}s with ${tc} state transitions.`);
          self.ack(msg)
        })

        runTask.on('error', function(err) {
          Logger.error(err)
          plugin.Logger.error('There has been an error processing this task.')
          self.ack(msg)
        })

        runTask.start().then(function(result) {
          plugin.Logger.log(`Taskname: ${result.name} started at ${new Date(result.startTime).toISOString()}.`)
        }).catch(function(err) {
          Logger.error(err);
        })
        return
      }

      console.log('Message string was null, discarding')
      self.ack(msg)

    }

    this.RabbitConnection.createChannel()
      .then((channel) => {
        this.TaskChannel = channel
        channel.assertQueue(this.options.taskqueue, {durable: true})
        loaded(null, null)
      })

  },
  start: function(done) {
    var self = this

    this.TaskChannel.consume(this.options.taskqueue, this.TaskHandler.bind(this.TaskChannel))

    done(null)
  },
  stop: function(done) {
    done()
  }
}
