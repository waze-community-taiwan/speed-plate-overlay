import {test} from 'node:test';
import assert from 'node:assert/strict';
import {browserExecutable, isWmeUrl, parseBuildOptions} from '../../scripts/manual-options.mjs';

test('normal builds stay noninteractive and manual mode accepts custom browser settings', () => {
  assert.equal(parseBuildOptions([], {}).manual, false);
  assert.deepEqual(parseBuildOptions(['--manual','--browser','/my browser/chrome','--port','9333','--url','https://www.waze.com/zh-TW/editor?zoomLevel=18'], {}), {
    manual:true,help:false,browser:'/my browser/chrome',port:9333,url:'https://www.waze.com/zh-TW/editor?zoomLevel=18',
  });
  assert.equal(parseBuildOptions(['--manual'], {WME_BROWSER_PATH:'/custom/edge'}).browser,'/custom/edge');
  assert.equal(browserExecutable('/Applications/Google Chrome.app','darwin'),'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
});

test('rejects malformed commands before launching a browser', () => {
  for (const args of [ ['--browser','chrome'], ['--manual','--browser'], ['--unknown'],
    ['--manual','--port','0'], ['--manual','--port','9225.5'], ['--manual','--port','65536'],
    ['--manual','--url','https://example.com/editor'], ['--manual','--url','https://www.waze.com/editor/sdk/'],
  ]) assert.throws(() => parseBuildOptions(args, {}));
});

test('injects only into production WME editor routes', () => {
  for (const url of ['https://www.waze.com/editor','https://www.waze.com/zh-TW/editor?env=row']) assert.equal(isWmeUrl(url),true);
  for (const url of ['https://accounts.google.com/','https://www.waze.com/editor/sdk/','https://www.waze.com/en/editor/profile','https://www.waze.com.evil.test/editor','http://www.waze.com/editor','garbage']) assert.equal(isWmeUrl(url),false);
});
