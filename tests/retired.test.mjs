// Verify retirement under Node without loading the Supabase runtime or accessing the network.
import test from 'node:test';
import assert from 'node:assert/strict';

let registrations = [];
globalThis.Deno = {
  serve: (handler) => registrations.push(handler),
  env: { get: () => { throw new Error('secret lookup must not occur'); } },
};
globalThis.fetch = () => { throw new Error('outbound requests must not occur'); };
const ask = await import('../functions/ask/index.ts');
const track = await import('../functions/track/index.ts');
assert.equal(registrations.length, 2);
for (const [name, module] of [['ask', ask], ['track', track]]) {
  for (const method of ['POST', 'GET', 'OPTIONS']) {
    test(`${name} ${method} is retired without reading visitor input`, async () => {
      const request = new Request('https://example.invalid/retired', {method});
      request.text = () => { throw new Error('body must not be read'); };
      const response = module.retiredResponse(request);
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await response.json()).error, 'This portfolio endpoint has been retired.');
    });
  }
  test(`${name} ignores a malformed, large body`, async () => {
    const response = module.retiredResponse(new Request('https://example.invalid/', {
      method:'POST',body:'{bad'.repeat(250000),
    }));
    assert.equal(response.status,410);
  });
}
