const ALLOWED_ORIGIN = 'https://wcrean.github.io';

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=120',
      ...corsHeaders(request),
    },
  });
}

function unfoldIcs(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function unescapeIcs(value = '') {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseProperty(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = left.split(';');
  const params = {};
  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq !== -1) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

function normalizeDate(prop) {
  if (!prop) return null;
  const raw = prop.value;
  const isDate = prop.params.VALUE === 'DATE' || /^\d{8}$/.test(raw);
  if (isDate) {
    return {
      raw,
      allDay: true,
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      timeZone: null,
      isUtc: false,
    };
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return { raw, allDay: false, dateTime: null, timeZone: prop.params.TZID || null, isUtc: raw.endsWith('Z') };
  const [, y, m, d, hh, mm, ss = '00', z] = match;
  const localIso = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  return {
    raw,
    allDay: false,
    dateTime: z ? `${localIso}Z` : localIso,
    timeZone: prop.params.TZID || null,
    isUtc: Boolean(z),
  };
}

function parseEvents(icsText) {
  const lines = unfoldIcs(icsText).split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.DTSTART) {
        events.push({
          uid: current.UID ? unescapeIcs(current.UID.value) : null,
          title: current.SUMMARY ? unescapeIcs(current.SUMMARY.value) : 'Untitled event',
          start: normalizeDate(current.DTSTART),
          end: normalizeDate(current.DTEND),
          status: current.STATUS ? current.STATUS.value : null,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseProperty(line);
    if (!prop) continue;
    if (['UID', 'SUMMARY', 'DTSTART', 'DTEND', 'STATUS'].includes(prop.name)) current[prop.name] = prop;
  }

  return events.filter((event) => event.status !== 'CANCELLED');
}

function eventSortKey(event) {
  if (event.start?.allDay) return `${event.start.date}T00:00:00`;
  return event.start?.dateTime || '9999';
}

function isNearToday(event, days = 2) {
  const now = new Date();
  const min = new Date(now);
  min.setDate(now.getDate() - 1);
  min.setHours(0, 0, 0, 0);
  const max = new Date(now);
  max.setDate(now.getDate() + days);
  max.setHours(23, 59, 59, 999);

  let start;
  if (event.start?.allDay) start = new Date(`${event.start.date}T12:00:00`);
  else if (event.start?.dateTime) start = new Date(event.start.dateTime);
  else return false;

  return start >= min && start <= max;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== 'GET') return json(request, { error: 'Method not allowed' }, 405);

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json(request, { ok: true, service: 'daily-planner-calendar' });
    }
    if (url.pathname !== '/agenda') return json(request, { error: 'Not found' }, 404);
    if (!env.COZI_ICAL_URL) return json(request, { error: 'Calendar secret is not configured.' }, 500);

    try {
      const upstream = await fetch(env.COZI_ICAL_URL, {
        headers: { 'User-Agent': 'DailyPlanner/0.2' },
        cf: { cacheTtl: 120, cacheEverything: true },
      });
      if (!upstream.ok) throw new Error(`Cozi returned ${upstream.status}`);
      const ics = await upstream.text();
      const events = parseEvents(ics)
        .filter(isNearToday)
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));

      return json(request, {
        generatedAt: new Date().toISOString(),
        events,
      });
    } catch (error) {
      console.error('Calendar fetch failed', error);
      return json(request, { error: 'Unable to load calendar right now.' }, 502);
    }
  },
};
