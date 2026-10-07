// Retired portfolio endpoint: respond without reading bodies, credentials or visitor data.
export function retiredResponse(_request: Request): Response {
  return Response.json({ error: 'This portfolio endpoint has been retired.' }, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  });
}

Deno.serve(retiredResponse);
