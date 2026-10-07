// Historical reporting requires explicit owner credentials and a trusted HTTPS project origin.
import test from 'node:test';
import assert from 'node:assert/strict';
import {display, ownerConfig, tageArg} from '../bericht.mjs';

const origin = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
test('anonymous credentials cannot read historical logs', () => {
  assert.throws(()=>ownerConfig({SUPABASE_URL:origin,SUPABASE_ANON_KEY:'test'}),/owner access/);
});
test('the report accepts owner credentials on the configured hosted origin', () => {
  assert.deepEqual(ownerConfig({SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:'owner-test-value'}),
    {origin,key:'owner-test-value'});
});
test('report credentials are not sent to foreign or ambiguous origins', () => {
  for (const url of ['http://aaaaaaaaaaaaaaaaaaaa.supabase.co','https://example.invalid',
    origin+'/path','https://user@aaaaaaaaaaaaaaaaaaaa.supabase.co']) {
    assert.throws(()=>ownerConfig({SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:'owner-test-value'}));
  }
});
test('report window is explicit and bounded', () => {
  assert.equal(tageArg([]),7);
  assert.equal(tageArg(['--tage=30']),30);
  for(const value of ['0','-1','1.5','Infinity','366','bad']) {
    assert.throws(()=>tageArg(['--tage='+value]));
  }
});
test('visitor metadata cannot emit terminal control sequences', () => {
  const output = display('\u001b[31mred\u0007\nnext');
  assert.equal(/[\u0000-\u001f\u007f-\u009f]/.test(output), false);
  assert.equal(display('x'.repeat(600)).length, 500);
});
