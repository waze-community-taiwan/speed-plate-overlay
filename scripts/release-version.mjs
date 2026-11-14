import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const parse = version => {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Invalid stable version: ${version}`);
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version exceeds safe integer range.');
  return parts;
};
const compare = (a,b) => { const x=parse(a),y=parse(b); return x[0]-y[0] || x[1]-y[1] || x[2]-y[2]; };
export function nextVersion(packageVersion, tags, bump='patch', override='') {
  parse(packageVersion);
  if (!['patch','minor','major'].includes(bump)) throw new Error('Invalid bump level.');
  const releases=tags.filter(tag=>/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)).map(tag=>tag.slice(1)).sort(compare);
  const latest=releases.at(-1);
  const base=latest && compare(latest,packageVersion)>0 ? latest : packageVersion;
  let version;
  if (override) { parse(override); version=override; }
  else if (!latest || compare(packageVersion,latest)>0) version=packageVersion;
  else {
    const parts=parse(base),index={major:0,minor:1,patch:2}[bump];
    parts[index]++; for (let i=index+1;i<3;i++) parts[i]=0;
    version=parts.join('.'); parse(version);
  }
  if (compare(version,packageVersion)<0 || (latest && compare(version,latest)<=0)) throw new Error('Release version must exceed existing tags and cannot downgrade package.json.');
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  const head=git('rev-parse','HEAD');
  const message=git('log','-1','--format=%B');
  const resume=message.split('\n').includes(`Release-Run: ${process.env.GITHUB_RUN_ID}`);
  const ready=resume || head===process.env.GITHUB_SHA;
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  if (!ready) {
    appendFileSync(process.env.GITHUB_OUTPUT,'ready=false\n');
    console.log('Skipping superseded push; the newer main commit has its own release run.');
  } else {
    const version=resume ? pkg.version : nextVersion(pkg.version,git('tag','--list').split('\n'),process.env.RELEASE_BUMP || 'patch',process.env.RELEASE_VERSION || '');
    parse(version);
    if (!resume) execFileSync('npm',['version',version,'--no-git-tag-version','--allow-same-version'],{stdio:'inherit'});
    if (resume && git('rev-list','-1',`v${version}`)!==head) throw new Error('Retry tag does not match release commit.');
    appendFileSync(process.env.GITHUB_OUTPUT,`ready=true\nversion=${version}\ntag=v${version}\nresume=${resume}\n`);
  }
}
