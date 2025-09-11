// /pages/api/proxy-image.js
export default async function handler(req, res) {
  try {
    const src = String(req.query.src || '');
    if (!/^https?:\/\//.test(src)) return res.status(400).send('invalid src');
    const resp = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ab = await resp.arrayBuffer();
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(Buffer.from(ab));
  } catch (e) { res.status(500).send('proxy error'); }
}
