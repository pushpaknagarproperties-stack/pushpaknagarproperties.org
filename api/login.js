const { sign, body, clean, getAuth, hashOf, sameHash, redis, hasDb, dk } = require('./_lib');
module.exports = async (req, res) => {
  const au = await getAuth();
  const SUPER = clean(au.superadmin || process.env.SUPER_HASH), EDITOR = clean(au.editor || process.env.EDITOR_HASH), VIEWER = clean(au.viewer || process.env.VIEWER_HASH);
  // Open https://YOUR-SITE/api/login in a browser to check the settings (shows only yes/no and lengths).
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, sessionSecret: !!process.env.SESSION_SECRET, superHashLength: SUPER.length, editorHashLength: EDITOR.length, viewerHashLength: VIEWER.length, expectedLength: 64, passwordsFromDatabase: { superadmin: !!au.superadmin, editor: !!au.editor } });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!process.env.SESSION_SECRET) return res.status(500).json({ ok: false, error: 'not configured' });
  const b = body(req);
  const u = String(b.u || '').toLowerCase(), p = String(b.p || '');
  const m = { superadmin: [SUPER, 'Super Admin'], editor: [EDITOR, 'Editor'], viewer: [VIEWER, 'Viewer'] }[u];
  const lg = async (ok, role) => { try { if (hasDb()) { await redis(['LPUSH', dk('loginlog'), JSON.stringify({ u: u.slice(0, 30), role: role || '', ok, t: Date.now(), ua: String(req.headers['user-agent'] || '').slice(0, 80) })]); await redis(['LTRIM', dk('loginlog'), 0, 99]); } } catch (e) {} };
  if (!m || !sameHash(hashOf(p), m[0])) {
    await lg(false, '');
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ ok: false });
  }
  await lg(true, m[1]);
  const exp = Date.now() + 864e5;
  return res.status(200).json({ ok: true, u, role: m[1], exp, token: sign({ u, role: m[1], exp, v: au.ver || 0 }) });
};
