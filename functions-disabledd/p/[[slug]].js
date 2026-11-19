
export async function onRequest({ request, env, params }) {
  try {
    const slug = params.slug;

    // Validasi slug project
    if (
      typeof slug !== 'string' ||
      !/^[a-z0-9-]{1,80}$/.test(slug)
    ) {
      return new Response('Slug PB tidak valid', {
        status: 400,
      });
    }

    // Ambil halaman Viewer dari static assets Cloudflare Pages
    const url = new URL(request.url);
    url.pathname = '/viewer.html';
    url.search = '';
    url.hash = '';

    const response = await env.ASSETS.fetch(
      new Request(url.toString(), {
        method: 'GET',
      })
    );

    if (!response.ok) {
      return new Response(
        'Halaman viewer.html tidak ditemukan',
        { status: 404 }
      );
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });

  } catch (error) {
    return new Response(
      'Gagal membuka Viewer: ' + error.message,
      { status: 500 }
    );
  }
}
