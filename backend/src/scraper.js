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
    .split("⇄")
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
  const match = normalized.match(/Seating Service Type\s*:?\s*([^<\n\r]+?)(?:More Details|Ticketing System|$)/i);
  return match ? normalizeText(match[1]) : null;
}

function parseFareRangeFromText(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:Fare|ভাড়া|ভাড়া)\s*:?\s*([৳TkBDT0-9\s\-–.]+)/i);
  return match ? normalizeText(match[1]) : null;
}

function parseTicketingSystemWithCheerio($, root) {
  const heading = $(root)
    .find("h2")
    .filter((_index, element) => /Ticketing System/i.test($(element).text()))
    .first();

  if (!heading.length) return null;

  return normalizeText(heading.nextAll("p").first().text()) || null;
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
  const stops = [];

  routeTable.find("tr").each((_index, row) => {
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

  const pageText = normalizeText($("body").text());

  return normalizeBusRecord({
    ...parseName(h1),
    sourceUrl,
    slug: slugFromUrl(sourceUrl),
    stops,
    operatingHours: parseHoursFromText(pageText),
    seatingType: parseSeatingTypeFromText(pageText),
    fareRange: parseFareRangeFromText(pageText),
    ticketingSystem: parseTicketingSystemWithCheerio($, "body")
  });
}

function parseDetailPageFallback(html, sourceUrl) {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const routeTableStart = html.search(/<h2[^>]*>[\s\S]*?Routes[\s\S]*?<\/h2>/i);
  const tableHtml =
    routeTableStart >= 0
      ? html.slice(routeTableStart).match(/<table[\s\S]*?<\/table>/i)?.[0] || ""
      : "";
  const stops = [];
  const rowRegex = /<tr>\s*<td>(\d+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi;
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

  const pageText = stripTags(html);

  return normalizeBusRecord({
    ...parseName(titleMatch ? stripTags(titleMatch[1]) : ""),
    sourceUrl,
    slug: slugFromUrl(sourceUrl),
    stops,
    operatingHours: parseHoursFromText(pageText),
    seatingType: parseSeatingTypeFromText(pageText),
    fareRange: parseFareRangeFromText(pageText),
    ticketingSystem: null
  });
}

function normalizeBusRecord(bus) {
  return {
    name: bus.name,
    nameBn: bus.nameBn || null,
    slug: bus.slug || null,
    sourceUrl: bus.sourceUrl || null,
    seatingType: bus.seatingType || null,
    fareRange: bus.fareRange || null,
    operatingHours: {
      start: bus.operatingHours?.start || null,
      end: bus.operatingHours?.end || null
    },
    ticketingSystem: bus.ticketingSystem || null,
    stops: bus.stops
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
    stops: detail.stops.length >= base.stops.length ? detail.stops : base.stops,
    operatingHours: {
      start: detail.operatingHours.start || base.operatingHours.start,
      end: detail.operatingHours.end || base.operatingHours.end
    },
    seatingType: detail.seatingType || base.seatingType,
    fareRange: detail.fareRange || base.fareRange,
    ticketingSystem: detail.ticketingSystem || base.ticketingSystem
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
