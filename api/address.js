'use strict';

const { directory, OUTSIDE, UNAVAILABLE } = require('../lib/service-area');

module.exports = async function address(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error:'Method not allowed.'});
  }
  if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) {
    return res.status(415).json({error:'JSON is required.'});
  }
  if (Number(req.headers['content-length'] || 0) > 2048) return res.status(413).json({error:'Request too large.'});
  let input = req.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { return res.status(400).json({error:'Invalid request.'}); }
  }
  if (!input || typeof input !== 'object') return res.status(400).json({error:'Invalid request.'});
  try {
    if (typeof input.query === 'string' && input.query.length <= 180 && !('id' in input)) {
      return res.status(200).json({suggestions: directory().suggest(input.query)});
    }
    if (typeof input.id !== 'string' || 'query' in input) {
      return res.status(400).json({error:'Invalid request.'});
    }
    const { id } = input;
    const match = directory().resolve(id);
    if (!match) return res.status(422).json({code:'address_unknown',error:UNAVAILABLE});
    if (!match.eligible) return res.status(422).json({code:'address_outside',error:OUTSIDE});
    return res.status(200).json({address:match});
  } catch {
    return res.status(503).json({code:'address_unavailable',error:UNAVAILABLE});
  }
};
