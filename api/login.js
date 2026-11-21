// api/login.js - VERCEL MASTER ke liye - GitHub se CHECKED
// Deploy: Vercel > panvelprojects.in > /api/login.js me ye file daalo
// Env chahiye: SESSION_SECRET, SUPER_HASH, EDITOR_HASH (Vercel Dashboard > Settings > Environment Variables)
// Agar SESSION_SECRET nahi hai to login 500 'not configured' dega - isliye pehle Env check karo
// GET /api/login browser me khol ke check karo: sessionSecret:true hona chahiye
// GHL (.IN) par ye file NAHI chalegi - GHL par Worker v6.15 ka /api/login use hoga
// ---
const { sign, body, clean, getAuth, hashOf, sameHash } = require('./_lib');
module.exports = async (req, res) => {
  const au = await getAuth();
  const SUPER = clean(au.superadmin || process.env.SUPER_HASH), EDITOR = clean(au.editor || process.env.EDITOR_HASH);
  // Open https://YOUR-SITE/api/login in a browser to check the settings (shows only yes/no and lengths).
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, sessionSecret: !!process.env.SESSION_SECRET, superHashLength: SUPER.length, editorHashLength: EDITOR.length, expectedLength: 64, passwordsFromDatabase: { superadmin: !!au.superadmin, editor: !!au.editor } });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!process.env.SESSION_SECRET) return res.status(500).json({ ok: false, error: 'not configured' });
  const b = body(req);
  const u = String(b.u || '').toLowerCase(), p = String(b.p || '');
  const m = { superadmin: [SUPER, 'Super Admin'], editor: [EDITOR, 'Editor'] }[u];
  if (!m || !sameHash(hashOf(p), m[0])) {
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ ok: false });
  }
  const exp = Date.now() + 864e5;
  return res.status(200).json({ ok: true, u, role: m[1], exp, token: sign({ u, role: m[1], exp, v: au.ver || 0 }) });
};
