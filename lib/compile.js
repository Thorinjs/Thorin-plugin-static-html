'use strict';
/**
 * Created by Adrian on 18-Apr-16.
 * performs the LESS-compiler on the given input-output-options tuplet
 */
const path = require('path'),
  fs = require('fs');

module.exports = function(thorin, opt) {
  const logger = thorin.logger(opt.logger),
    fse = thorin.util.fs;
  /*
   * Do the actual compiler.
   * */
  let transportObj = thorin.transport(opt.transport);
  if (!transportObj) {
    logger.warn(`A valid HTTP transport is required for the static generator to work.`);
  }
  return function compile(actionObj, onDone) {
    if (!transportObj) return done();
    let config = transportObj.getConfig(),
      baseUrl = 'http://127.0.0.1';
    baseUrl += ':' + config.port;
    if (config.basePath !== '/') {
      baseUrl += config.basePath;
    }
    let aliases = actionObj.aliases;
    if (aliases.length === 0) {
      logger.warn(`Action ${actionObj.name} should have an alias to generate the static html`);
      return onDone();
    }
    let calls = [];
    aliases.forEach((alias) => {
      calls.push((done) => {
        let actionUrl = baseUrl;
        if(alias.name.charAt(0) !== '/') {
          actionUrl += '/';
        }
        if(alias.name === '*') return done();
        actionUrl += alias.name;
        const fetchOpt = {
          method: alias.verb,
          follow: 1,
          timeout: 40000
        };
        let statusCode;
        thorin.util
          .fetch(actionUrl, fetchOpt)
          .then((res) => {
            statusCode = res.status;
            if(statusCode >= 400) {
              logger.warn(`Action ${actionObj.name} responded with ${statusCode}`);
              throw new thorin.error('FETCH.STATUS', 'Invalid HTTP Status code');
            }
            return res.text();
          })
          .then((html) => {
            let filePath = (alias.name);
            if(filePath === '/') {
              filePath = '/index';
            }
            let targetFile = path.normalize(opt.output + "/" + filePath + '.html');
            fse.ensureFile(targetFile, (e) => {
              if(e) {
                logger.warn(`Could not ensure output file ${targetFile} for action ${actionObj.name}`);
                return done(e);
              }
              fs.writeFile(targetFile, html, { encoding: 'utf8' }, (e) => {
                if(e) {
                  logger.warn(`Could not write HTML to file ${targetFile}`);
                  return done(e);
                }
                logger.info(`Generated static HTML: ${filePath}.html`);
                done();
              });
            });
          })
          .catch((e) => {
            logger.error(`Encountered an error while generating static HTML for action ${actionObj.name} (${actionUrl})`);
            return done(e);
          });
      });
    });
    thorin.util.async.series(calls, onDone);
  }
};