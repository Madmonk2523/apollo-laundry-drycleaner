'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');

const MILES = 3;
const OUTSIDE = "Pickup and delivery aren’t available at this address.";
const UNAVAILABLE = 'We couldn’t verify this address. Please try again or call Apollo at (929) 264-6070.';
const CITY = ['', 'Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
const miles = (from, to) => {
  const rad = Math.PI / 180;
  const dLat = (to[0] - from[0]) * rad;
  const dLon = (to[1] - from[1]) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from[0] * rad) * Math.cos(to[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 / 1609.344 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
};
const streetWords = {
  STREET:'ST', AVENUE:'AVE', BOULEVARD:'BLVD', ROAD:'RD', DRIVE:'DR',
  PLACE:'PL', LANE:'LN', COURT:'CT', TERRACE:'TER', CIRCLE:'CIR', PARKWAY:'PKWY',
  EXPRESSWAY:'EXPY', HIGHWAY:'HWY', SQUARE:'SQ', PLAZA:'PLZ', NORTH:'N', SOUTH:'S',
  EAST:'E', WEST:'W'
};
const normalize = value => value.toUpperCase().replace(/[.’']/g,'').replace(/[‐‑–—]/g,'-').replace(/[^A-Z0-9 -]/g,' ')
  .trim().split(/\s+/).map(word => streetWords[word] ?? (/^\d+(ST|ND|RD|TH)$/.test(word) ? word.replace(/\D+$/, '') : word)).join(' ');
const displayStreet = value => value.trim().replace(/\s+/g,' ').toLowerCase().replace(/\b[a-z]/g, x => x.toUpperCase());
const boroughWords = [[], ['MANHATTAN','NEW YORK','NEW YORK CITY','NYC'], ['BRONX','THE BRONX'],
  ['BROOKLYN','GREENPOINT','WILLIAMSBURG','BUSHWICK','BEDFORD STUYVESANT','BED STUY','DUMBO','DOWNTOWN BROOKLYN','CLINTON HILL','FORT GREENE'],
  ['QUEENS','ASTORIA','LONG ISLAND CITY','LIC','SUNNYSIDE','WOODSIDE','RIDGEWOOD','MASPETH','JACKSON HEIGHTS'],
  ['STATEN ISLAND']];
let cached;
function directory() {
  if (cached) return cached;
  const data = JSON.parse(gunzipSync(readFileSync(join(__dirname, '..', 'data', 'address-points.json.gz'))));
  cached = makeDirectory(data);
  return cached;
}

function makeDirectory({rows, shopPointId}) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('Address directory missing');
  const byId = new Map(), byHouse = new Map(), byLabel = new Map();
  const labelKey = row => [row[1],normalize(row[2]),row[3],row[4]].join('|');
  for (const row of rows) {
    const [id, house, street, zip, borough, lat, lon] = row;
    byId.set(id, row);
    const label = labelKey(row);
    if (byLabel.has(label)) byLabel.get(label).push(row);
    else byLabel.set(label,[row]);
    const entries = byHouse.get(house);
    const key = normalize(street);
    // NYC AddressPoint contains duplicate building records. Collapse identical inputs when coordinates agree.
    const item = {row, key};
    if (entries) entries.push(item);
    else byHouse.set(house, [item]);
  }
  const shop = byId.get(shopPointId);
  if (!shop || !shop.slice(5).every(Number.isFinite)) throw new Error('Storefront point missing');
  const storefront = shop.slice(5);
  function present(row) {
    const [id, house, street, zip, borough, lat, lon] = row;
    return {id: String(id), street: `${house} ${displayStreet(street)}`, city: CITY[borough], zip,
      eligible: miles(storefront, [lat,lon]) <= MILES};
  }
  function resolve(id) {
    if (typeof id !== 'string' || !/^\d{1,10}$/.test(id)) return null;
    const row = byId.get(Number(id));
    if (!row || !row.slice(5).every(Number.isFinite)) return null;
    const value = present(row);
    return byLabel.get(labelKey(row)).some(other => present(other).eligible !== value.eligible) ? null : value;
  }
  function suggest(query) {
    if (typeof query !== 'string' || query.length > 180) return [];
    // If a full address is pasted, apartment details are separate from lookup.
    const trimmed = query.trim().replace(/[‐‑–—]/g,'-').replace(/\s*(?:#|\b(?:APT|APARTMENT|UNIT|SUITE|FL)\.?\s)[^,]*(?=,|$)/i,'');
    const parsed = /^(\d+(?:-\d+)?[A-Z]?)\s+(.+)$/i.exec(trimmed);
    if (!parsed) return [];
    let [,house,rest] = parsed;
    house = house.toUpperCase();
    // State/country and ZIP are optional, but an explicit non-NY state is never silently dropped.
    if (/\b(?:NJ|CT|PA|MA|FL|CA)(?:\s+\d{5}(?:-\d{4})?)?(?:,?\s+USA)?$/i.test(rest) && /,/.test(rest)) return [];
    const zip = /\b(\d{5})(?:-\d{4})?(?:,?\s+USA)?\s*$/i.exec(rest)?.[1];
    if (zip) rest = rest.slice(0, rest.lastIndexOf(zip)).replace(/[-,\s]+$/, '');
    rest = rest.replace(/(?:,?\s+(?:USA|US))?\s*$/i,'').replace(/,?\s+(?:NY|N\.Y\.)\s*[,]?$/i,'');
    const parts = rest.split(',').map(normalize).filter(Boolean);
    const typed = parts.join(' ');
    if (!typed || typed.length < 2) return [];
    const explicitCity = parts.slice(1).join(' ');
    const candidates = [];
    for (const {row,key} of byHouse.get(house) ?? []) {
      if (zip && row[3] !== zip) continue;
      const aliases = boroughWords[row[4]];
      if (explicitCity && !aliases.includes(explicitCity)) continue;
      let rank = -1;
      if (typed === key || aliases.some(alias => typed === key + ' ' + alias)) rank = 0;
      else if (!explicitCity && key.startsWith(typed)) rank = 1;
      else if (parts[0] === key) rank = 0;
      else if (explicitCity && key.startsWith(parts[0])) rank = 1;
      if (rank < 0) continue;
      candidates.push({row, rank, distance:miles(storefront,row.slice(5))});
    }
    candidates.sort((a,b) => a.rank-b.rank || a.distance-b.distance || a.row[0]-b.row[0]);
    const matches = [];
    for (const {row} of candidates) {
      // Never ask the visitor to choose between indistinguishable points. If identical
      // mailing labels disagree on radius, omit the ambiguous building and offer a call.
      const value = resolve(String(row[0]));
      if (!value) continue;
      if (matches.some(a => a.street === value.street && a.city === value.city && a.zip === value.zip)) continue;
      // Eligibility is disclosed only after selecting a specific address.
      const {eligible, ...label} = value;
      matches.push(label);
      if (matches.length === 7) break;
    }
    return matches;
  }
  return {resolve,suggest,storefront};
}
module.exports = {directory,makeDirectory,miles,MILES,OUTSIDE,UNAVAILABLE};
