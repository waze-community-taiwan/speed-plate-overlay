import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextVersion} from '../../scripts/release-version.mjs';
test('initial release uses package version and ignores unrelated tags',()=>assert.equal(nextVersion('0.1.0',['docs','vbroken']),'0.1.0'));
test('default patch uses highest numeric version, including orphan tags',()=>assert.equal(nextVersion('0.1.0',['v0.1.9','v0.1.10']),'0.1.11'));
test('manual bump and explicit larger package versions are respected',()=>{
  assert.equal(nextVersion('0.1.0',['v0.1.0'],'minor'),'0.2.0');
  assert.equal(nextVersion('0.1.0',['v0.1.0'],'major'),'1.0.0');
  assert.equal(nextVersion('0.3.0',['v0.1.1']),'0.3.0');
  assert.equal(nextVersion('0.1.0',['v0.1.0'],'patch','0.5.0'),'0.5.0');
});
test('rejects collisions, downgrades and invalid inputs',()=>{
  for (const version of ['0.1.0','0.0.9','1.2.3-beta','1.2.3\nready=true','01.2.3']) assert.throws(()=>nextVersion('0.1.0',['v0.1.0'],'patch',version));
  assert.throws(()=>nextVersion('0.1.0',[],'unsafe'));
});
