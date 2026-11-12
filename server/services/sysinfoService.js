// The router's hidden support bundle (diagnostics/GetSysinfoData): ~300 KB of text that takes ~35 s to build.
// We fetch it once, cache it briefly, split it on its "==== Title ====" headings and make it searchable.
import { httpError } from '../lib/httpError.js';

const HEADING_PATTERN = /^=+\s*(.*[A-Za-z].*?)\s*=+$/;
const FETCH_TIMEOUT_MS = 120_000;
const CACHE_TTL_MS = 120_000;
const MAX_SEARCH_HITS = 300;
const MAX_QUERY_LENGTH = 100;

export function parseSections(text) {
  const lines = text.split('\n');
  const sections = [];
  lines.forEach((line, index) => {
    const match = HEADING_PATTERN.exec(line.trim());
    if (match) {
      sections.push({ name: match[1].trim(), startLine: index, lineCount: 0 });
    }
  });
  sections.forEach((section, position) => {
    const end = sections[position + 1]?.startLine ?? lines.length;
    section.lineCount = end - section.startLine - 1;
  });
  return { lines, sections };
}

export function searchLines(parsed, query) {
  const needle = query.toLowerCase();
  const hits = [];
  let current = '(preamble)';
  let nextHeading = 0;
  for (let index = 0; index < parsed.lines.length && hits.length < MAX_SEARCH_HITS; index += 1) {
    if (parsed.sections[nextHeading]?.startLine === index) {
      current = parsed.sections[nextHeading].name;
      nextHeading += 1;
    } else if (parsed.lines[index].toLowerCase().includes(needle)) {
      hits.push({ section: current, line: index + 1, text: parsed.lines[index].slice(0, 300) });
    }
  }
  return hits;
}

export function createSysinfoService(client, { now = () => Date.now() } = {}) {
  let cache = null;
  let pending = null;

  async function load(forceRefresh) {
    if (!forceRefresh && cache && now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache;
    }
    // Share one in-flight 35 s fetch between concurrent callers instead of hammering the router.
    pending ??= client
      .call('diagnostics/GetSysinfoData', {}, { timeoutMs: FETCH_TIMEOUT_MS })
      .then((output) => {
        cache = { fetchedAt: now(), parsed: parseSections(output.sysinfo ?? '') };
        return cache;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  return {
    async getSections(forceRefresh = false) {
      const { fetchedAt, parsed } = await load(forceRefresh);
      return {
        fetchedAt: new Date(fetchedAt).toISOString(),
        totalLines: parsed.lines.length,
        sections: parsed.sections,
      };
    },
    async getSection(name) {
      const { parsed } = await load(false);
      const section = parsed.sections.find((item) => item.name === name);
      if (!section) {
        throw httpError(404, 'No such section');
      }
      return {
        ...section,
        text: parsed.lines.slice(section.startLine + 1, section.startLine + 1 + section.lineCount).join('\n'),
      };
    },
    async search(query) {
      if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
        throw httpError(400, `q must be 2 to ${MAX_QUERY_LENGTH} characters`);
      }
      const { parsed } = await load(false);
      const hits = searchLines(parsed, query);
      return { hits, isTruncated: hits.length >= MAX_SEARCH_HITS };
    },
  };
}
