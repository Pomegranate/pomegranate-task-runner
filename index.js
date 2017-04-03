/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-task-runner
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';

/**
 *
 * @module index
 */

module.exports = [
  require('./plugins/MachineLoader'),
  require('./plugins/TaskRunner')
]