// api/data.js - VERCEL MASTER ke liye - GitHub se CHECKED
// Ye wali file use karo: data.js (15519 chars, 9 LOCS + Navi Mumbai fix)
// data_3e9bc2.js (12444 chars, 8 LOCS) PURANI hai - usko mat use karo, usme Navi Mumbai + Rebale fix nahi hai
// Deploy: Vercel > panvelprojects.in > /api/data.js me ye file daalo
// Env chahiye: Upstash Redis (via _lib.js), SESSION_SECRET
// GHL (.IN) par ye file NAHI chalegi - GHL par Worker v6.15 ka /api/data use hoga
// ---
const { redis, hasDb, verify, body, getAuth, dk, prefix, unsafePreview } = require('./_lib');
const PUB = { projects: 'projects', cfg: 'cfg', testi: 'testi', legal: 'legal' };
const PRIV = { brand: 'brand', campaigns: 'campaigns', legalh: 'legalh', legald: 'legald' };
const LOCS = ['Panvel', 'Karanjade', 'Pushpak Nagar', 'Ulwe', 'Kharghar', 'Taloja', 'Kamothe', 'Kalamboli', 'Navi Mumbai']; // TOTAL 9: Main 8 + Navi Mumbai (1). Navi Mumbai ke 11 nodes Sector me aayenge, Location me nahi.
const NM_SECTORS = ['CBD Belapur', 'Nerul', 'Seawood', 'Sanpada', 'Turbhe', 'Vashi', 'Koparkhairane', 'Ghansoli', 'Rabale', 'Airoli', 'Digha']; // Navi Mumbai Sector list
const TYPES = ['flat', 'plot', 'villa', 'shop', 'office'];
const STATUSES = ['draft', 'active', 'inactive', 'archived'];
const TXS = ['Buy', 'Sale', 'Resale', 'Rent'];
const AVAIL = ['Active', 'Sold'];
const DOMS = ['in', 'org', 'master'];
const STR = ['name', 'sec', 'bhk', 'ps', 're', 'img', 'vid', 'near', 'desc', 'd2', 'd3', 'pdf1', 'pdf2', 'pdf3', 'wa', 'dre', 'pdisc', 'rev'];
const probe = async () => { try { return (await redis(['PING'])) === 'PONG'; } catch (e) { return false; } };
const num = (v) => { const x = Number(v); return isFinite(x) && x >= 0 ? x : 0; };
const pickCI = (list, v) => list.find((x) => x.toLowerCase() === String(v == null ? '' : v).trim().toLowerCase());

// Server-side validation: every property is checked and cleaned before it is saved.
function cleanProject(p) {
  if (!p || typeof p !== 'object') return { e: 'row is not an object' };
  const id = String(p.id || '').trim();
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return { e: 'bad property id "' + id.slice(0, 20) + '"' };
  const o = { id };
  for (const k of STR) o[k] = String(p[k] == null ? '' : p[k]).trim().slice(0, k === 'img' ? 4000 : k === 'wa' ? 3000 : 2000);
  o.rev = o.rev === '1' ? '1' : '';
  o.pdisc = o.pdisc.replace(/<[^>]*>/g, '');
  o.dre = o.dre.replace(/[^A-Za-z0-9 ,\/\-]/g, '');
  if (!o.name) return { e: id + ': project name missing' };
  // P03-R2 FIX: Purani 19-location wali entry (Location=Vashi etc) ko naye 9-location model me badlo: Location=Navi Mumbai, Sector=Vashi
  const _oldNM = ['cbd belapur','nerul','seawood','sanpada','turbhe','vashi','koparkhairane','ghansoli','rabale','rebale','airoli','digha'];
  if (_oldNM.indexOf(String(p.loc || '').trim().toLowerCase()) > -1) { const _s = String(p.loc).trim().toLowerCase() === 'rebale' ? 'Rabale' : String(p.loc).trim(); p.loc = 'Navi Mumbai'; if (!p.sec) p.sec = _s; else if (String(p.sec).toLowerCase().indexOf(_s.toLowerCase()) < 0) p.sec = _s + ' ' + String(p.sec).trim(); }
  if (String(p.loc || '').trim().toLowerCase() === 'rebale') p.loc = 'Rabale';
  const loc = pickCI(LOCS, p.loc); if (!loc) return { e: id + ': location not allowed' }; o.loc = loc;
  // Sector: Navi Mumbai ke liye Rebale -> Rabale
  if (o.loc === 'Navi Mumbai' && p.sec && String(p.sec).trim().toLowerCase() === 'rebale') p.sec = 'Rabale';
  if (o.loc === 'Navi Mumbai' && p.sec) { const _sl = String(p.sec).toLowerCase(); const _m = NM_SECTORS.filter(s => _sl.indexOf(s.toLowerCase()) > -1); if (_m.length && _m[0].toLowerCase() === 'rabale') { /* keep as is */ } }
  o.sec = String(p.sec || o.sec || '').trim().slice(0, 2000); if (o.sec.toLowerCase() === 'rebale') o.sec = 'Rabale';
  const ty = pickCI(TYPES, p.ty || 'flat'); if (!ty) return { e: id + ': type not allowed' }; o.ty = ty;
  const st = pickCI(STATUSES, p.st || (p.on === false ? 'inactive' : 'active')); if (!st) return { e: id + ': status not allowed' }; o.st = st;
  const tx = pickCI(TXS, p.tx || 'Buy'); if (!tx) return { e: id + ': Sale/Rent value not allowed' }; o.tx = tx;
  const av = pickCI(AVAIL, p.stt || 'Active'); if (!av) return { e: id + ': availability not allowed' }; o.stt = av;
  const doms = Array.isArray(p.doms) ? p.doms.map((d) => String(d).trim().toLowerCase()) : [];
  if (doms.some((d) => !DOMS.includes(d))) return { e: id + ': domain not allowed' };
  o.doms = [...new Set(doms)];
  o.pl = num(p.pl); o.cp = num(p.cp);
  if (p.seo && typeof p.seo === 'object') o.seo = { t: String(p.seo.t || '').slice(0, 200), d: String(p.seo.d || '').slice(0, 400) };
  o.rv = p.rv === true;
  o.on = o.st === 'active';
  return { o, created: Number(p.created) || 0 };
}
const strip = (p) => { const { created, updated, ...r } = p; return JSON.stringify(r); };
function diff(oldArr, newArr, by) {
  const o = new Map(oldArr.map((p) => [p.id, p])), n = new Map(newArr.map((p) => [p.id, p])), ev = [];
  for (const [id, p] of n) {
    const q = o.get(id);
    if (!q) { ev.push({ a: 'create', id, name: p.name }); continue; }
    const ch = Object.keys(p).filter((k) => !['created', 'updated'].includes(k) && JSON.stringify(p[k]) !== JSON.stringify(q[k]));
    if (!ch.length) continue;
    let a = 'edit';
    if (ch.includes('st')) a = p.st === 'active' ? 'publish' : p.st === 'archived' ? 'archive' : p.st === 'inactive' ? 'deactivate' : 'status-' + p.st;
    ev.push({ a, id, name: p.name, fields: ch.slice(0, 10) });
  }
  for (const [id, q] of o) if (!n.has(id)) ev.push({ a: 'delete', id, name: q.name });
  const t = Date.now();
  return ev.map((e) => ({ ...e, by, t }));
}
const cstr = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
const chex = (v, d) => /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : d;
function cleanBrand(b) {
  if (!b || typeof b !== 'object') return null;
  const id = cstr(b.id, 40); if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return null;
  return { id, name: cstr(b.name, 80), company: cstr(b.company, 120), phone: cstr(b.phone, 20), website: /^https?:\/\//.test(String(b.website || '')) ? cstr(b.website, 200) : '', tagline: cstr(b.tagline, 120), agentRera: cstr(b.agentRera, 40), site: cstr(b.site, 60), c1: chex(b.c1, '#0a1a3a'), c2: chex(b.c2, '#d4af37'), c3: chex(b.c3, '#ffffff') };
}
function cleanCamp(c) {
  if (!c || typeof c !== 'object') return null;
  const id = cstr(c.id, 40); if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return null;
  const o = c.out && typeof c.out === 'object' ? c.out : {};
  return { id, t: Number(c.t) || Date.now(), pid: cstr(c.pid, 40), pn: cstr(c.pn, 120), bid: cstr(c.bid, 40), type: cstr(c.type, 40), lang: cstr(c.lang, 20), approved: c.approved === true, out: { h: cstr(o.h, 300), s: cstr(o.s, 300), wa: cstr(o.wa, 3000), cap: cstr(o.cap, 2200), tags: cstr(o.tags, 600), reel: cstr(o.reel, 3000) } };
}
const ctext = (v, n) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/\r/g, '').trim().slice(0, n);
function cleanLegal(d) {
  const a = d.agent && typeof d.agent === 'object' ? d.agent : {};
  const box = (x) => ({ show: !!(x && x.show === true), text: ctext(x && x.text, 1200) });
  const pages = (Array.isArray(d.pages) ? d.pages : []).slice(0, 8).map((p) => ({ slug: cstr(p && p.slug, 40).toLowerCase().replace(/[^a-z0-9-]/g, ''), title: cstr(p && p.title, 120), body: ctext(p && p.body, 20000), published: !!(p && p.published === true), seoT: cstr(p && p.seoT, 70), seoD: cstr(p && p.seoD, 170), updated: Number(p && p.updated) || 0, ver: Number(p && p.ver) || 1 })).filter((p) => p.slug);
  return { agent: { name: cstr(a.name, 120), rera: cstr(a.rera, 40), website: /^https?:\/\//.test(String(a.website || '')) ? cstr(a.website, 200) : '', phone: cstr(a.phone, 20) }, pages, footer: box(d.footer), prop: box(d.prop), enq: box(d.enq) };
}
function cleanHist(h) {
  if (!h || typeof h !== 'object') return null;
  const slug = cstr(h.slug, 40).toLowerCase().replace(/[^a-z0-9-]/g, ''); if (!slug) return null;
  return { t: Number(h.t) || Date.now(), u: cstr(h.u, 40), slug, title: cstr(h.title, 120), body: ctext(h.body, 20000), ver: Number(h.ver) || 1 };
}
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); return res.status(204).end(); }
  try {
    const k = String((req.query && req.query.key) || '');
    // Open https://YOUR-SITE/api/data in a browser to check the database (shows yes/no only).
    if (req.method === 'GET' && !k) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ ok: true, databaseKeysFound: hasDb(), databaseReachable: hasDb() ? await probe() : false, prefix: prefix(), stagingBlocked: unsafePreview() });
    }
    if (!hasDb()) return res.status(503).json({ ok: false, error: unsafePreview() ? 'staging needs DB_PREFIX' : 'database not connected' });
    let s = verify((req.headers.authorization || '').replace('Bearer ', ''));
    if (s) { const au = await getAuth(); if ((s.v || 0) !== (au.ver || 0)) s = null; }
    if (req.method === 'GET') {
      if (PUB[k]) {
        const v = await redis(['GET', dk(PUB[k])]);
        res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ ok: true, data: v ? JSON.parse(v) : null });
      }
      if (PRIV[k]) {
        if (!s) return res.status(401).json({ ok: false });
        const v = await redis(['GET', dk(PRIV[k])]);
        return res.status(200).json({ ok: true, data: v ? JSON.parse(v) : null });
      }
      if (k === 'leads' || k === 'audit') {
        if (!s) return res.status(401).json({ ok: false });
        const v = await redis(['LRANGE', dk(k), 0, 199]);
        return res.status(200).json({ ok: true, data: v.map((x) => JSON.parse(x)) });
      }
      return res.status(404).json({ ok: false });
    }
    if (req.method === 'POST') {
      if (!s) return res.status(401).json({ ok: false });
      const b = body(req);
if (k === 'leads') {
        // P02-R1 CRM: delete (Super Admin only) OR full-list save (Super Admin + Editor).
        const STAGES = ['New', 'Contacted', 'Visit Scheduled', 'Visit Done', 'Negotiating', 'Booked', 'Lost'];
        const cleanLead = (l) => {
          if (!l || typeof l !== 'object') return null;
          const id = String(l.id || '').trim();
          if (!/^[A-Za-z0-9_-]{2,40}$/.test(id)) return null;
          const d = /^\d{4}-\d{2}-\d{2}$/.test(String(l.d || '')) ? String(l.d).slice(0, 10) : '';
          const fu = /^\d{4}-\d{2}-\d{2}$/.test(String(l.fu || '')) ? String(l.fu).slice(0, 10) : '';
          return { id, n: cstr(l.n, 120), p: cstr(l.p, 20), pj: cstr(l.pj, 300), d, stage: STAGES.includes(l.stage) ? l.stage : 'New', fu, notes: ctext(l.notes, 2000), next: cstr(l.next, 300), src: cstr(l.src, 60) };
        };
        if (b.del) {
          if (s.role !== 'Super Admin') return res.status(403).json({ ok: false });
          const cur = (await redis(['LRANGE', dk('leads'), 0, -1])).map((x) => JSON.parse(x)).filter((l) => l.id !== b.del);
          await redis(['DEL', dk('leads')]);
          for (const l of cur.reverse()) await redis(['LPUSH', dk('leads'), JSON.stringify(l)]);
          return res.status(200).json({ ok: true });
        }
        if (Array.isArray(b.data)) {
          if (s.role !== 'Super Admin' && s.role !== 'Editor') return res.status(403).json({ ok: false });
          if (b.data.length > 2000 || JSON.stringify(b.data).length > 900000) return res.status(413).json({ ok: false });
          const cleaned = b.data.map(cleanLead).filter(Boolean);
          if (cleaned.length !== b.data.length) return res.status(400).json({ ok: false, error: 'invalid lead' });
          await redis(['DEL', dk('leads')]);
          for (const l of cleaned.slice().reverse()) await redis(['LPUSH', dk('leads'), JSON.stringify(l)]);
          return res.status(200).json({ ok: true, count: cleaned.length });
        }
        return res.status(400).json({ ok: false });
      }
      if (PRIV[k]) {
        if (k === 'legald') return res.status(404).json({ ok: false });
        const pd = b.data;
        if (!Array.isArray(pd) || JSON.stringify(pd).length > 400000) return res.status(400).json({ ok: false });
        if ((k === 'brand' || k === 'legalh') && s.role !== 'Super Admin') return res.status(403).json({ ok: false });
        if (pd.length > (k === 'brand' ? 20 : k === 'legalh' ? 60 : 300)) return res.status(413).json({ ok: false });
        const out = pd.map(k === 'brand' ? cleanBrand : k === 'legalh' ? cleanHist : cleanCamp).filter(Boolean);
        await redis(['SET', dk(PRIV[k]), JSON.stringify(out)]);
        await redis(['LPUSH', dk('audit'), JSON.stringify({ a: 'edit-' + k, id: k, name: String(out.length), by: s.u, t: Date.now() })]);
        return res.status(200).json({ ok: true, count: out.length });
      }
      if (!PUB[k]) return res.status(404).json({ ok: false });
      const d = b.data;
      if (JSON.stringify(d || null).length > 900000) return res.status(413).json({ ok: false });
      if (k === 'cfg' || k === 'legal' ? (typeof d !== 'object' || Array.isArray(d) || !d) : !Array.isArray(d)) return res.status(400).json({ ok: false });
      if (k !== 'projects') {
        if (s.role !== 'Super Admin') return res.status(403).json({ ok: false });
        if (k === 'legal') {
          const L = cleanLegal(d);
          await redis(['SET', dk('legald'), JSON.stringify(L)]);
          await redis(['SET', dk('legal'), JSON.stringify({ ...L, pages: L.pages.filter((p) => p.published) })]);
          await redis(['LPUSH', dk('audit'), JSON.stringify({ a: 'edit-legal', id: 'legal', name: '', by: s.u, t: Date.now() })]);
          return res.status(200).json({ ok: true });
        }
        await redis(['SET', dk(PUB[k]), JSON.stringify(d)]);
        await redis(['LPUSH', dk('audit'), JSON.stringify({ a: 'edit-' + k, id: k, name: '', by: s.u, t: Date.now() })]);
        return res.status(200).json({ ok: true });
      }
      if (d.length > 2000) return res.status(413).json({ ok: false });
      const cleaned = [], seen = new Set();
      for (let i = 0; i < d.length; i++) {
        const c = cleanProject(d[i]);
        if (c.e) return res.status(400).json({ ok: false, error: 'invalid', detail: 'row ' + (i + 1) + ': ' + c.e });
        const key = c.o.id.toLowerCase();
        if (seen.has(key)) return res.status(400).json({ ok: false, error: 'duplicate', detail: 'Property ID "' + c.o.id + '" is used twice' });
        seen.add(key); cleaned.push(c);
      }
      const raw = await redis(['GET', dk('projects')]);
      const old = raw ? JSON.parse(raw) : null;
      if (s.role !== 'Super Admin') {
        if (!old || old.length !== cleaned.length || !cleaned.every((c) => old.some((q) => q.id === c.o.id))) return res.status(403).json({ ok: false });
      }
      const oldMap = new Map((old || []).map((q) => [q.id, q])), now = Date.now();
      const next = cleaned.map((c) => {
        const q = oldMap.get(c.o.id), o = c.o;
        o.created = q ? (q.created || now) : (c.created || now);
        o.updated = q && strip(q) === strip(o) ? (q.updated || now) : now;
        return o;
      });
      const events = diff(old || [], next, s.u);
      if (raw) await redis(['SET', dk('projects:prev'), raw]); // one-step undo copy
      await redis(['SET', dk('projects'), JSON.stringify(next)]);
      if (events.length) { await redis(['LPUSH', dk('audit'), ...events.map((e) => JSON.stringify(e))]); await redis(['LTRIM', dk('audit'), 0, 1999]); }
      return res.status(200).json({ ok: true, count: next.length, changes: events.length });
    }
    return res.status(405).json({ ok: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false });
  }
};
