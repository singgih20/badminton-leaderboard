export async function onRequest({env}) {return env.ASSETS.fetch(new Request('https://internal.local/admin.html'))}
