
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

async function upstream(env, payload) {
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      ...payload,
      secret: env.APPS_SCRIPT_SECRET
    }),
    redirect: 'follow'
  });

  const raw = await response.text();
  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      'Apps Script tidak mengembalikan JSON. Periksa deployment Web App.'
    );
  }

  if (!data.ok) {
    throw new Error(data.error || 'Kesalahan Google Sheets');
  }

  return data;
}

async function checkPassword(env, password) {
  if (typeof password !== 'string' || !password) {
    return false;
  }

  const result = await upstream(env, {
    action: 'login',
    password
  });

  return result.authenticated === true;
}

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join('/');

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_SECRET) {
    return json({
      error: 'Environment secrets belum dikonfigurasi'
    }, 503);
  }

  try {
    // LOGIN ADMIN
    if (path === 'login' && request.method === 'POST') {
      const body = await request.json();

      const authenticated = await checkPassword(
        env,
        body.password
      );

      return json({
        authenticated,
        ...(!authenticated
          ? { error: 'Password salah' }
          : {})
      }, authenticated ? 200 : 401);
    }

    // VIEWER PUBLIK
    if (path === 'public' && request.method === 'GET') {
      const slug = new URL(request.url)
        .searchParams.get('slug');

      if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) {
        return json({
          error: 'Slug PB tidak valid'
        }, 400);
      }

      const result = await upstream(env, {
        action: 'read'
      });

      const project = (result.data?.projects || [])
        .find(p => p.slug === slug);

      if (!project) {
        return json({
          error: 'PB tidak ditemukan'
        }, 404);
      }

      return json({
        project,
        revision: result.revision
      });
    }

    // DATA ADMIN (GET / POST)
    if (
      path === 'state' &&
      (request.method === 'GET' || request.method === 'POST')
    ) {
      const password =
        request.headers.get('X-Admin-Password') || '';

      const authenticated = await checkPassword(
        env,
        password
      );

      if (!authenticated) {
        return json({
          error: 'Password admin salah atau belum login'
        }, 401);
      }

      // BACA DATA
      if (request.method === 'GET') {
        return json(
          await upstream(env, {
            action: 'read'
          })
        );
      }

      // SIMPAN DATA
      const body = await request.json();

      if (
        !body.data ||
        !Array.isArray(body.data.projects) ||
        body.data.projects.length > 100
      ) {
        return json({
          error: 'Data tidak valid'
        }, 400);
      }

      return json(
        await upstream(env, {
          action: 'write',
          data: body.data,
          expectedRevision: body.revision
        })
      );
    }

    return json({
      error: 'Endpoint tidak ditemukan'
    }, 404);

  } catch (error) {
    return json({
      error: String(error.message || error)
    }, 500);
  }
}
