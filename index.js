'use strict';
const path = require('path');
/**
 * Created by Adrian on 08-Apr-16.
 *
 * The static HTML generator will essentially use the rendering engine and the http transport to
 * save all the rendered HTML for all the given routes, to the file system, as static HTML pages.
 *
 * Note that this plugin works by performing a GET request to the alias of all registered actions
 * and saving the result HTML into the static folder, using the given alias as the file path.
 *
 */
const initCompile = require('./lib/compile');
module.exports = function(thorin, opt, pluginName) {
  opt = thorin.util.extend({
    logger: pluginName || 'static-html',
    actions: null,        // specific actions to download only. If set, it should be an array of action names.
    output: thorin.root + '/public/static', // the output directory for the static HTML pages.
    transport: 'http',  // the HTTP transport name
    wait: 1000,       // wait 1000 ms before we start
    compile: null // the actual compile function that will do all the HTML downloading.
  }, opt);
  if (typeof opt.compile !== 'function') opt.compile = initCompile(thorin, opt);
  opt.output = path.normalize(opt.output);
  const logger = thorin.logger(opt.logger);
  const staticObj = {};

  /*
   * Generate the actual HTML files.
   * */
  staticObj.generate = (done) => {
    let actions = filterActions(thorin.dispatcher.actions);
    // Check if we have only specific actions.

    if (actions.length === 0) return done && done();
    let calls = [];
    actions.forEach((actionObj) => {
      calls.push((done) => opt.compile(actionObj, done));
    });
    logger.trace(`Compiling ${actions.length} ` + (actions.length === 1 ? 'action' : 'actions'));
    thorin.util.async.series(calls, (e) => {
      if (e) {
        logger.error(`Failed to compile all static files.`);
        logger.debug(e);
        return done && done(e);
      }
      done && done();
    });
  };

  /* Run the plugin */
  staticObj.run = (done) => {
    // Wait for the transport to start up and then do it
    thorin.on(thorin.EVENT.RUN, 'transport.' + opt.transport, () => {
      setTimeout(() => {
        staticObj.generate();
      }, opt.wait);
    });
    return done();
  };

  /* Setup the plugin. */
  staticObj.setup = (done) => {
    /* Ensure that we have the output path. */
    try {
      thorin.util.fs.ensureDirSync(opt.output);
      return done();
    } catch (e) {
      return done(e);
    }
  };

  /*
   * Filters out actions that do not match any pattern in the options.
   * */
  function filterActions(items) {
    let result = [];
    // We have to include only actions that include a render template. Ignore all others.
    items.forEach((actionObj) => {
      if (!actionObj.renderTemplates) return;  //no rendering
      let templates = actionObj.renderTemplates;
      // check if any error
      if (templates.error.length > 0 || templates.success || Object.keys(templates.all).length > 0) {
        result.push(actionObj);
      }
    });
    if (opt.actions == null) return result; // no filters.

    let filtered = [];
    // TODO: apply filter
    return filtered;
  }

  return staticObj;
};
module.exports.publicName = 'static-html';