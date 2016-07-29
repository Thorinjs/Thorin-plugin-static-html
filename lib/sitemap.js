'use strict';
/**
 * Created by Adrian on 18-Apr-16.
 * Generates the sitemap.xml based on the given array of actions.
 */
const path = require('path'),
  fs = require('fs');

module.exports = function(thorin, opt) {
  const logger = thorin.logger(opt.logger),
    fse = thorin.util.fs;
  return function generateSitemap(actions, onDone) {
    if (!actions || actions.length === 0) return onDone();
    logger.info('Generating sitemap.xml');
    let urls = [];
    actions.forEach((actionObj) => {
      if (actionObj.aliases.length === 0) return;
      let alias = actionObj.aliases[0];
      if (alias.verb !== 'GET') return;
      if (alias.name === '/404' || alias.name === '/500') return;  // these specific cases we ignore.
      urls.push(alias.name);
    });
    if (urls.length === 0) return onDone();
    // for each url, generate the xml
    let xml = ['<?xml version="1.0" encoding="UTF-8"?>\n'];
    xml.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);
    urls.forEach((url) => {
      let prio = (url === '/' ? `\n   <priority>1</priority>` : ``);
      xml.push(`
  <url>
    <loc>${opt.sitemap.domain + url}</loc>
    <changefreq>${opt.sitemap.frequency}</changefreq>${prio}
  </url>`);
    });
    xml.push(`\n</urlset>`);
    let finalXml = xml.join('');
    let targetFile = path.normalize(opt.output + '/sitemap.xml');
    fse.ensureFile(targetFile, (e) => {
      if(e) {
        logger.warn(`Could not ensure sitemap.xml in ${targetFile}`);
        return onDone(e);
      }
      fs.writeFile(targetFile, finalXml, { encoding: 'utf8' }, (e) => {
        if(e) {
          logger.warn(`Could not write sitemap.xml content to ${targetFile}`);
          return onDone(e);
        }
        logger.info(`Generated sitemap.xml (${urls.length}) urls.`);
        onDone();
      });
    });
  }
};