
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

// ========================================
// GOOGLE APPS SCRIPT API
// ========================================

async function upstream(env, payload) {
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...payload,
      secret: env.APPS_SCRIPT_SECRET,
    }),
    redirect: 'follow',
  });

  const body = await response.text();

  let data;

  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      'Apps Script tidak mengembalikan JSON. ' +
      'Periksa deployment dan akses Web App.'
    );
  }

  if (!data.ok) {
    throw new Error(
      data.error || 'Kesalahan Google Sheets'
    );
  }

  return data;
}

// ========================================
// CLOUDFLARE PAGES FUNCTION
// ========================================

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join('/');

  // Tidak membutuhkan ADMIN_PASSWORD
  // Tidak membutuhkan SESSION_SECRET
  if (
    !env.APPS_SCRIPT_URL ||
    !env.APPS_SCRIPT_SECRET
  ) {
    return json(
      {
        error: 'Environment secrets belum dikonfigurasi',
      },
      503
    );
  }

  try {
    // ========================================
    // PUBLIC VIEWER
    // GET /api/public?slug=pbsm
    // ========================================

    if (path === 'public' && request.method === 'GET') {
      const slug = new URL(request.url)
        .searchParams.get('slug');

      if (
        !slug ||
        !/^[a-z0-9-]{1,80}$/.test(slug)
      ) {
        return json(
          { error: 'Slug tidak valid' },
          400
        );
      }

      const data = await upstream(env, {
        action: 'read',
      });

      const project = (
        data.data?.projects || []
      ).find((p) => p.slug === slug);

      if (!project) {
        return json(
          { error: 'PB tidak ditemukan' },
          404
        );
      }

      // Hilangkan viewerToken dari respons publik
      const { viewerToken, ...publicProject } = project;

      return json({
        project: publicProject,
        revision: data.revision,
      });
    }

    // ========================================
    // GET ALL PROJECT DATA
    // GET /api/state
    // ========================================

    if (path === 'state' && request.method === 'GET') {
      const data = await upstream(env, {
        action: 'read',
      });

      return json(data);
    }

    // ========================================
    // SAVE ALL PROJECT DATA
    // POST /api/state
    // ========================================

    if (path === 'state' && request.method === 'POST') {
      const { data, revision } = await request.json();

      if (
        !data ||
        !Array.isArray(data.projects) ||
        data.projects.length > 100
      ) {
        return json(
          { error: 'Data tidak valid' },
          400
        );
      }

      const result = await upstream(env, {
        action: 'write',
        data,
        expectedRevision: revision,
      });

      return json(result);
    }

    // ========================================
    // ENDPOINT NOT FOUND
    // ========================================

    return json(
      { error: 'Endpoint tidak ditemukan' },
      404
    );

  } catch (error) {
    return json(
      {
        error: String(
          error.message || error
        ),
      },
      500
    );
  }
}
