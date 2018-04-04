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
 * Note:
 * the plugin is also an event emitter that will emit the "compile" event once the compilation process
 * is done.
 *
 */
const initCompile = require('./lib/compile'),
  initSitemap = require('./lib/sitemap');
module.exports = function(thorin, opt, pluginName) {
  opt = thorin.util.extend({
    logger: pluginName || 'static-html',
    actions: null,        // specific actions to download only. If set, it should be an array of action names.
    output: thorin.root + '/public/static', // the output directory for the static HTML pages.
    transport: 'http',  // the HTTP transport name
    wait: 1000,       // wait 1000 ms before we start
    autorun: true,
    compile: null, // the actual compile function that will do all the HTML downloading.
    extension: '.html', // The extension of the files (leave blank for none)
    minify: false,  // Set to true to minify the html using html-minifier
    minifyOptions: {   // Default minify options
      minifyCSS: true,
      minifyJS: true,
      conservativeCollapse: true,
      keepClosingSlash: true,
      collapseWhitespace: true,
      removeComments: true,
      removeTagWhitespace: false
    },
    sitemap: {
      compile: null,  // the compile function that will be used to generate the sitemap.
      frequency: 'weekly', // how often does the site change.
      domain: ''        // the actual domain that we're generating the sitemap for.
    } // Setting sitemap to false, will not generate the sitemap.
  }, opt);
  if (typeof opt.compile !== 'function') opt.compile = initCompile(thorin, opt);
  if (typeof opt.sitemap === 'object' && opt.sitemap) {
    if (typeof opt.sitemap.compile !== 'function') {
      opt.sitemap.compile = initSitemap(thorin, opt);
    }
  } else {
    opt.sitemap = false;
  }
  opt.output = path.normalize(opt.output);
  const logger = thorin.logger(opt.logger),
    async = thorin.util.async;
  const staticObj = new thorin.util.Event();

  /*
   * Given a list of HTTP paths, it will perform the generate() on them.
   * Note: when we do this, we essentially simulate the custom actions, by
   * adding them to the dispatcher.
   * WARNING: once the generation process is complete, the process MUST
   * shutdown.
   * */
  staticObj.generatePaths = (paths, done) => {
    let actions = [];
    paths.forEach((gPath) => {
      gPath = gPath.replace(/\\/g, '/');
      if (gPath.charAt(0) !== '/') gPath = '/' + gPath;
      let actionObj = {
        name: 'static' + gPath.replace(/\//g, '.'),
        aliases: [{
          verb: 'GET',
          name: gPath
        }]
      };
      actions.push(actionObj);
    });
    let calls = [];
    actions.forEach((actionObj) => {
      calls.push((done) => opt.compile(actionObj, done));
    });
    // generate sitemap if enabled
    if (opt.sitemap) {
      calls.push((done) => opt.sitemap.compile(actions, done));
    }
    logger.trace(`Compiling ${actions.length} ` + (actions.length === 1 ? 'path' : 'paths'));
    async.series(calls, (e) => {
      if (e) {
        logger.error(`Failed to compile all custom path static files.`);
        logger.debug(e);
        return done && done(e);
      }
      staticObj.emit('compile');
      done && done();
    });
  };

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
    // Finally, generate the sitemap
    if (opt.sitemap) {
      calls.push((done) => opt.sitemap.compile(actions, done));
    }
    logger.trace(`Compiling ${actions.length} ` + (actions.length === 1 ? 'action' : 'actions'));
    async.series(calls, (e) => {
      if (e) {
        logger.error(`Failed to compile all static files.`);
        logger.debug(e);
        return done && done(e);
      }
      staticObj.emit('compile');
      done && done();
    });
  };

  /* Run the plugin */
  staticObj.run = (done) => {
    if (opt.autorun === false) return done();
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
