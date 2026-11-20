// Run with: node --test tests/profile-regressions.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const profilesSource = fs.readFileSync('profiles.js', 'utf8');

function functionSource(source, signature, nextMarker) {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, 'Expected function markers in source');
  return source.slice(start, end);
}
const legacySource = functionSource(html, 'function validState(data){', '\nasync function initialize()');
const profileSource = functionSource(profilesSource, '  function parseProfileBackup(data) {', '\n  let saved = null;');
const context = vm.createContext({ Date, Number, String, Array, Set, Error, makeId: (() => {let n=0;return () => 'generated-'+(++n);})() });
vm.runInContext(legacySource + '\n' + profileSource, context);

const legacy = {kids:['A','B'], shows:[
  {id:1,title:'One',category:'Comedy',ratings:[5,3],watched:'Completed'},
  {id:2,title:'Two',category:'Nature',ratings:[4,2],watched:'Watching'},
  {id:3,title:'Three',category:'Nature',ratings:[0,0],watched:'Unwatched'}
]};
test('legacy validation preserves watch status and both ratings', () => {
  const parsed = context.validState(legacy);
  assert.deepEqual(Array.from(parsed.shows, s=>s.watched), ['Completed','Watching','Unwatched']);
  assert.deepEqual(Array.from(parsed.shows[0].ratings), [5,3]);
});
test('legacy validation defaults invalid or missing watch status safely', () => {
  const parsed = context.validState({...legacy, shows:[{...legacy.shows[0], watched:'bogus'}]});
  assert.equal(parsed.shows[0].watched,'Unwatched');
});
const profile = (id,name) => ({id,name,shows:[{id:1,title:'One',category:'Comedy',rating:5,watched:'Completed'}]});
const backup = profiles => ({format:'tv-show-shelf-profiles',version:1,profiles});
test('profile import rejects duplicate IDs even with distinct names', () => {
  assert.throws(() => context.parseProfileBackup(backup([profile('same','A'),profile('same','B')])), /unique/);
});
test('profile import rejects blank IDs', () => {
  assert.throws(() => context.parseProfileBackup(backup([profile(' ','A')])), /nonblank/);
});
test('profile import preserves distinct IDs, ratings, and watch status', () => {
  const parsed = context.parseProfileBackup(backup([profile('a','A'),profile('b','B')]));
  assert.deepEqual(Array.from(parsed,p=>p.id), ['a','b']);
  assert.equal(parsed[0].shows[0].rating,5);
  assert.equal(parsed[0].shows[0].watched,'Completed');
});
test('legacy watch-status UI calls synchronous save', () => {
  assert.match(html, /show\.watched=select\.value;save\(\);renderSuggestions\(\)/);
  assert.match(profilesSource, /save = persist;/);
});
