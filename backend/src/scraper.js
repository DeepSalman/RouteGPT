import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SOURCE_URL = "https://dhakabusservice.com/";
const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL("../data/bus_data.json", import.meta.url)
);
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 RouteGPT/0.1";

const BANGLA_RANGE = /[\u0980-\u09FF]/;

function parseArgs(argv) {
  const args = {
    sourceUrl: DEFAULT_SOURCE_URL,
    output: DEFAULT_OUTPUT_PATH,
    limit: null,
    details: false,
    concurrency: 4,
    delayMs: 150,
    pretty: true
  };

  for (const arg of argv) {
    if (arg === "--details") args.details = true;
    else if (arg === "--no-details") args.details = false;
    else if (arg === "--compact") args.pretty = false;
    else if (arg.startsWith("--source-url=")) args.sourceUrl = arg.split("=", 2)[1];
    else if (arg.startsWith("--output=")) args.output = path.resolve(arg.split("=", 2)[1]);
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--concurrency=")) args.concurrency = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--delay-ms=")) args.delayMs = Number(arg.split("=", 2)[1]);
  }

  return args;
}

function normalizeText(value) {
  return decodeHtml(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&rarr;/g, "->")
    .replace(/&larr;/g, "<-")
    .replace(/&hellip;/g, "...");
}

function stripTags(html) {
  return normalizeText(String(html).replace(/<[^>]*>/g, " "));
}

function slugFromUrl(url) {
  if (!url) return null;
  const pathname = new URL(url).pathname.replace(/\/+$/, "");
  return pathname.split("/").pop() || null;
}

function parseName(rawName) {
  const raw = normalizeText(rawName)
    .replace(/\s+Bus Route\b.*$/i, "")
    .replace(/\s+-\s+Dhaka Bus Service$/i, "")
    .trim();
  const parsed = splitEnglishBangla(raw);

  return {
    name: parsed.name,
    nameBn: parsed.nameBn,
    raw
  };
}

function splitEnglishBangla(rawValue) {
  const raw = normalizeText(rawValue);
  const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);

  if (!match) {
    return {
      name: raw,
      nameBn: null,
      raw
    };
  }

  const possibleBangla = normalizeText(match[2]);
  if (!BANGLA_RANGE.test(possibleBangla)) {
    return {
      name: raw,
      nameBn: null,
      raw
    };
  }

  return {
    name: normalizeText(match[1]),
    nameBn: possibleBangla,
    raw
  };
}

function parseStopsFromRouteText(routeText) {
  return normalizeText(routeText)
    .split(/⇄|â‡„/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .map((rawStop, index) => {
      const parsed = splitEnglishBangla(rawStop);

      return {
        order: index + 1,
        name: parsed.name,
        nameBn: parsed.nameBn,
        raw: parsed.raw
      };
    });
}

function parseHoursFromText(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /Starting Time\s*:?\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M)\s*&\s*Closing Time\s*:?\s*([0-9]{1,2}:[0-9]{2}\s*[AP]M)/i
  );

  if (!match) {
    return {
      start: null,
      end: null
    };
  }

  return {
    start: normalizeText(match[1]),
    end: normalizeText(match[2])
  };
}

function parseSeatingTypeFromText(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /Seating Service Type\s*:?\s*(.+?)(?:More Details|Ticketing System|Bus Counter|Routes Google Map|Frequently Asked Questions|Last updated|$)/i
  );

  if (!match) return null;

  return normalizeText(match[1]).replace(/^.*?Seating Service Type\s*:?\s*/i, "");
}

function parseFareRangeFromText(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:Fare|ভাড়া|ভাড়া)\s*:?\s*([৳TkBDT0-9\s\-–.]+)/i);
  return match ? normalizeText(match[1]) : null;
}

function parseLastUpdatedFromText(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /Last updated\s*:?\s*(.*?)(?:&copy;|©|All rights|Facebook|$)/i
  );
  return match ? normalizeText(match[1]) : null;
}

function parseDescriptionWithCheerio($) {
  const h1 = $("h1").first();
  const paragraphs = [];

  h1.nextUntil("h2").each((_index, element) => {
    const tagName = element.tagName || element.name;
    if (tagName?.toLowerCase() !== "p") return;

    const text = normalizeText($(element).text());
    if (text && !/youtube\.com/i.test(text)) {
      paragraphs.push(text);
    }
  });

  return paragraphs.join("\n\n") || null;
}

function parseTicketingSystemWithCheerio($, root) {
  const heading = $(root)
    .find("h2")
    .filter((_index, element) => /Ticketing System/i.test($(element).text()))
    .first();

  if (!heading.length) return null;

  return normalizeText(heading.nextAll("p").first().text()) || null;
}

function parseStopsFromTableRows($, table) {
  const stops = [];

  table.find("tr").each((_index, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    const order = Number(normalizeText($(cells[0]).text()));
    const rawStop = normalizeText($(cells[1]).text());
    if (!Number.isFinite(order) || !rawStop) return;

    const parsed = splitEnglishBangla(rawStop);
    stops.push({
      order,
      name: parsed.name,
      nameBn: parsed.nameBn,
      raw: parsed.raw
    });
  });

  return stops;
}

function parseCounterStopsWithCheerio($, root) {
  const heading = $(root)
    .find("h2")
    .filter((_index, element) => /Bus Counter|Counter\/Stoppage/i.test($(element).text()))
    .first();

  if (!heading.length) return [];

  return parseStopsFromTableRows($, heading.nextAll("table").first());
}

async function loadCheerio() {
  try {
    const cheerio = await import("cheerio");
    return cheerio;
  } catch {
    return null;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,bn;q=0.8",
      "Cache-Control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseHomePageWithCheerio(cheerio, html, sourceUrl) {
  const $ = cheerio.load(html);
  const buses = [];

  $("table.route-table tbody tr").each((_index, row) => {
    const rowText = normalizeText($(row).text());
    const nameRaw =
      normalizeText($(row).find("td.hide-on-mobile strong").first().text()) ||
      normalizeText($(row).find(".hide-on-desktop strong").first().text());
    const routeRaw = normalizeText($(row).find(".hello").first().text());
    const sourceHref = $(row).find('a[href*="/bus/"]').first().attr("href");
    const source = sourceHref ? new URL(sourceHref, sourceUrl).toString() : null;

    if (!nameRaw || !routeRaw) return;

    buses.push(normalizeBusRecord({
      ...parseName(nameRaw),
      sourceUrl: source,
      slug: source ? slugFromUrl(source) : null,
      stops: parseStopsFromRouteText(routeRaw),
      operatingHours: parseHoursFromText(rowText),
      seatingType: parseSeatingTypeFromText(rowText),
      fareRange: parseFareRangeFromText(rowText),
      ticketingSystem: null
    }));
  });

  return buses;
}

function parseHomePageFallback(html, sourceUrl) {
  const buses = [];
  const rowRegex = /<tr>\s*<td class="hide-on-mobile">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const nameHtml = match[1];
    const detailHtml = match[2];
    const nameMatch = nameHtml.match(/<strong>([\s\S]*?)<\/strong>/i);
    const routeMatch = detailHtml.match(/<div class="hello">([\s\S]*?)<\/div>/i);
    const hrefMatch = detailHtml.match(/<a\s+href="([^"]*\/bus\/[^"]*)"/i);

    if (!nameMatch || !routeMatch) continue;

    const rowText = stripTags(detailHtml);
    const source = hrefMatch ? new URL(decodeHtml(hrefMatch[1]), sourceUrl).toString() : null;

    buses.push(normalizeBusRecord({
      ...parseName(stripTags(nameMatch[1])),
      sourceUrl: source,
      slug: source ? slugFromUrl(source) : null,
      stops: parseStopsFromRouteText(stripTags(routeMatch[1])),
      operatingHours: parseHoursFromText(rowText),
      seatingType: parseSeatingTypeFromText(rowText),
      fareRange: parseFareRangeFromText(rowText),
      ticketingSystem: null
    }));
  }

  return buses;
}

function parseDetailPageWithCheerio(cheerio, html, sourceUrl) {
  const $ = cheerio.load(html);
  const h1 = normalizeText($("h1").first().text());
  const routeHeading = $("h2")
    .filter((_index, element) => /Routes/i.test($(element).text()))
    .first();
  const routeTable = routeHeading.nextAll("table").first();
  const stops = parseStopsFromTableRows($, routeTable);

  const pageText = normalizeText($("body").text());

  return normalizeBusRecord({
    ...parseName(h1),
    sourceUrl,
    slug: slugFromUrl(sourceUrl),
    description: parseDescriptionWithCheerio($),
    stops,
    counterStops: parseCounterStopsWithCheerio($, "body"),
    operatingHours: parseHoursFromText(pageText),
    seatingType: parseSeatingTypeFromText(pageText),
    fareRange: parseFareRangeFromText(pageText),
    ticketingSystem: parseTicketingSystemWithCheerio($, "body"),
    lastUpdated: parseLastUpdatedFromText(pageText)
  });
}

function extractSectionHtml(html, headingPattern) {
  const headingRegex = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    if (!headingPattern.test(stripTags(match[0]))) continue;

    const start = headingRegex.lastIndex;
    const rest = html.slice(start);
    const nextHeading = rest.search(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i);
    return nextHeading >= 0 ? rest.slice(0, nextHeading) : rest;
  }

  return "";
}

function parseFirstParagraphFromHtml(html) {
  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const text = paragraphMatch ? stripTags(paragraphMatch[1]) : stripTags(html);
  return text || null;
}

function parseDescriptionFallback(html) {
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
  if (!h1Match) return null;

  const afterH1 = html.slice((h1Match.index || 0) + h1Match[0].length);
  const beforeH2 = afterH1.split(/<h2[^>]*>/i)[0] || "";
  const paragraphs = [...beforeH2.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((text) => text && !/youtube\.com/i.test(text));

  return paragraphs.join("\n\n") || null;
}

function parseStopsFromTableHtml(tableHtml) {
  const stops = [];
  const rowRegex =
    /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const rawStop = stripTags(match[2]);
    const parsed = splitEnglishBangla(rawStop);

    stops.push({
      order: Number(match[1]),
      name: parsed.name,
      nameBn: parsed.nameBn,
      raw: parsed.raw
    });
  }

  return stops;
}

function parseDetailPageFallback(html, sourceUrl) {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const routeSectionHtml = extractSectionHtml(html, /Routes/i);
  const routeTableHtml = routeSectionHtml.match(/<table[\s\S]*?<\/table>/i)?.[0] || "";
  const counterSectionHtml = extractSectionHtml(html, /Bus Counter|Counter\/Stoppage/i);
  const counterTableHtml = counterSectionHtml.match(/<table[\s\S]*?<\/table>/i)?.[0] || "";
  const ticketingSectionHtml = extractSectionHtml(html, /Ticketing System/i);
  const stops = parseStopsFromTableHtml(routeTableHtml);
  const counterStops = parseStopsFromTableHtml(counterTableHtml);

  const pageText = stripTags(html);

  return normalizeBusRecord({
    ...parseName(titleMatch ? stripTags(titleMatch[1]) : ""),
    sourceUrl,
    slug: slugFromUrl(sourceUrl),
    description: parseDescriptionFallback(html),
    stops,
    counterStops,
    operatingHours: parseHoursFromText(pageText),
    seatingType: parseSeatingTypeFromText(pageText),
    fareRange: parseFareRangeFromText(pageText),
    ticketingSystem: parseFirstParagraphFromHtml(ticketingSectionHtml),
    lastUpdated: parseLastUpdatedFromText(pageText)
  });
}

function normalizeBusRecord(bus) {
  return {
    name: bus.name,
    nameBn: bus.nameBn || null,
    slug: bus.slug || null,
    sourceUrl: bus.sourceUrl || null,
    description: bus.description || null,
    seatingType: bus.seatingType || null,
    fareRange: bus.fareRange || null,
    operatingHours: {
      start: bus.operatingHours?.start || null,
      end: bus.operatingHours?.end || null
    },
    ticketingSystem: bus.ticketingSystem || null,
    lastUpdated: bus.lastUpdated || null,
    stops: bus.stops
      .filter((stop) => stop.name)
      .sort((a, b) => a.order - b.order)
      .map((stop, index) => ({
        order: index + 1,
        name: stop.name,
        nameBn: stop.nameBn || null,
        raw: stop.raw
      })),
    counterStops: (bus.counterStops || [])
      .filter((stop) => stop.name)
      .sort((a, b) => a.order - b.order)
      .map((stop, index) => ({
        order: index + 1,
        name: stop.name,
        nameBn: stop.nameBn || null,
        raw: stop.raw
      }))
  };
}

function mergeBusRecords(base, detail) {
  if (!detail || !detail.name) return base;

  return normalizeBusRecord({
    ...base,
    ...detail,
    name: base.name || detail.name,
    nameBn: base.nameBn || detail.nameBn,
    sourceUrl: base.sourceUrl || detail.sourceUrl,
    slug: base.slug || detail.slug,
    description: detail.description || base.description,
    stops: detail.stops.length >= base.stops.length ? detail.stops : base.stops,
    counterStops: detail.counterStops.length ? detail.counterStops : base.counterStops || [],
    operatingHours: {
      start: detail.operatingHours.start || base.operatingHours.start,
      end: detail.operatingHours.end || base.operatingHours.end
    },
    seatingType: detail.seatingType || base.seatingType,
    fareRange: detail.fareRange || base.fareRange,
    ticketingSystem: detail.ticketingSystem || base.ticketingSystem,
    lastUpdated: detail.lastUpdated || base.lastUpdated
  });
}

function uniqueByBus(buses) {
  const seen = new Map();

  for (const bus of buses) {
    const key = bus.slug || bus.sourceUrl || bus.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, bus);
  }

  return [...seen.values()];
}

async function enrichWithDetailPages(buses, cheerio, options) {
  const queue = [...buses];
  const results = [];
  const workerCount = Math.max(1, Math.min(options.concurrency, queue.length));

  async function worker() {
    while (queue.length) {
      const bus = queue.shift();
      if (!bus.sourceUrl) {
        results.push(bus);
        continue;
      }

      try {
        await delay(options.delayMs);
        const html = await fetchText(bus.sourceUrl);
        const detail = cheerio
          ? parseDetailPageWithCheerio(cheerio, html, bus.sourceUrl)
          : parseDetailPageFallback(html, bus.sourceUrl);
        results.push(mergeBusRecords(bus, detail));
      } catch (error) {
        console.warn(`Could not enrich ${bus.name}: ${error.message}`);
        results.push(bus);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeDhakaBusService(options) {
  const cheerio = await loadCheerio();
  const html = await fetchText(options.sourceUrl);
  let buses = cheerio
    ? parseHomePageWithCheerio(cheerio, html, options.sourceUrl)
    : parseHomePageFallback(html, options.sourceUrl);

  buses = uniqueByBus(buses);

  if (options.limit) {
    buses = buses.slice(0, options.limit);
  }

  if (options.details) {
    buses = await enrichWithDetailPages(buses, cheerio, options);
  }

  return {
    scrapedAt: new Date().toISOString(),
    source: options.sourceUrl,
    parser: cheerio ? "cheerio" : "fallback",
    count: buses.length,
    buses
  };
}

async function writeJson(filePath, data, pretty = true) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, pretty ? 2 : 0), "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await scrapeDhakaBusService(options);

  if (!data.buses.length) {
    throw new Error("Scraper produced zero bus records.");
  }

  const invalidBus = data.buses.find((bus) => !bus.name || !bus.stops.length);
  if (invalidBus) {
    throw new Error(`Invalid bus record produced: ${JSON.stringify(invalidBus)}`);
  }

  await writeJson(options.output, data, options.pretty);
  console.log(`Scraped ${data.count} buses to ${options.output}`);
  console.log(`Parser: ${data.parser}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  parseStopsFromRouteText,
  scrapeDhakaBusService,
  splitEnglishBangla
};
