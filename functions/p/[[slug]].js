export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const slug = url.pathname.split('/').filter(Boolean)[1];

  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return new Response('Slug PB tidak valid', {
      status: 400
    });
  }

  const assetUrl = new URL('/admin.html', url.origin);

  return env.ASSETS.fetch(
    new Request(assetUrl.toString(), {
      method: 'GET'
    })
  );
}