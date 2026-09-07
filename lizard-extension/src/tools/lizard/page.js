/**
 * What the lizard can actually see.
 *
 * The rule the whole animal is built on is that it never says anything untrue,
 * because that is the only reason a rude pet is funny rather than annoying. In
 * Lumen the source of truth was a datastore. Out here it is the page itself,
 * which turns out to be a perfectly good source: how many words are under it,
 * how far down them you have got, whether the video is playing, what the site
 * calls itself. None of that is guessed and none of it is stored anywhere.
 *
 * Everything here is read-only and stays inside the tab. Nothing is sent
 * anywhere, and no page text is kept beyond the title and the one heading it
 * quotes back at you.
 *
 * Two costs are worth knowing about:
 *
 *   - Counting words walks the text of the page, so it is done once per URL and
 *     then remembered. Scroll position, the clock and the video are cheap, so
 *     those are read fresh every time.
 *   - A page with a password box on it gets no observations at all. It is not
 *     the lizard's business, and a joke about the box you are typing a password
 *     into is not a joke.
 */

/** Stop walking text after this many nodes. A news homepage has thousands. */
const NODE_CAP = 6000;
/** And keep this much of it to work out what the page is about. */
const SAMPLE_CAP = 5000;

/**
 * Sites it recognises by name.
 *
 * `key` is what the jokes are written against, so several domains can share
 * one; `name` is what it says out loud, so GitLab is never called GitHub.
 */
const SITES = [
  ["youtube.com", "youtube", "YouTube"],
  ["youtu.be", "youtube", "YouTube"],
  ["github.com", "code-host", "GitHub"],
  ["gitlab.com", "code-host", "GitLab"],
  ["bitbucket.org", "code-host", "Bitbucket"],
  ["stackoverflow.com", "stackoverflow", "Stack Overflow"],
  ["stackexchange.com", "stackoverflow", "Stack Exchange"],
  ["superuser.com", "stackoverflow", "Super User"],
  ["serverfault.com", "stackoverflow", "Server Fault"],
  ["reddit.com", "reddit", "Reddit"],
  ["news.ycombinator.com", "hackernews", "Hacker News"],
  ["x.com", "x", "X"],
  ["twitter.com", "x", "Twitter"],
  ["bsky.app", "x", "Bluesky"],
  ["mastodon.social", "x", "Mastodon"],
  ["wikipedia.org", "wikipedia", "Wikipedia"],
  ["google.com", "search", "Google"],
  ["bing.com", "search", "Bing"],
  ["duckduckgo.com", "search", "DuckDuckGo"],
  ["mail.google.com", "mail", "Gmail"],
  ["outlook.com", "mail", "Outlook"],
  ["outlook.office.com", "mail", "Outlook"],
  ["mail.yahoo.com", "mail", "Yahoo Mail"],
  ["amazon.com", "shopping", "Amazon"],
  ["amazon.co.uk", "shopping", "Amazon"],
  ["amazon.de", "shopping", "Amazon"],
  ["ebay.com", "shopping", "eBay"],
  ["etsy.com", "shopping", "Etsy"],
  ["aliexpress.com", "shopping", "AliExpress"],
  ["netflix.com", "streaming", "Netflix"],
  ["hulu.com", "streaming", "Hulu"],
  ["disneyplus.com", "streaming", "Disney+"],
  ["max.com", "streaming", "Max"],
  ["twitch.tv", "twitch", "Twitch"],
  ["instagram.com", "feed", "Instagram"],
  ["tiktok.com", "feed", "TikTok"],
  ["facebook.com", "feed", "Facebook"],
  ["pinterest.com", "feed", "Pinterest"],
  ["linkedin.com", "linkedin", "LinkedIn"],
  ["open.spotify.com", "music", "Spotify"],
  ["music.youtube.com", "music", "YouTube Music"],
  ["soundcloud.com", "music", "SoundCloud"],
  ["developer.mozilla.org", "docs", "MDN"],
  ["readthedocs.io", "docs", "Read the Docs"],
  ["docs.python.org", "docs", "the Python docs"],
  ["npmjs.com", "npm", "npm"],
  ["pypi.org", "npm", "PyPI"],
  ["chatgpt.com", "ai", "ChatGPT"],
  ["chat.openai.com", "ai", "ChatGPT"],
  ["claude.ai", "ai", "Claude"],
  ["gemini.google.com", "ai", "Gemini"],
  ["perplexity.ai", "ai", "Perplexity"],
  ["meet.google.com", "meeting", "Google Meet"],
  ["zoom.us", "meeting", "Zoom"],
  ["teams.microsoft.com", "meeting", "Teams"],
  ["slack.com", "chat", "Slack"],
  ["discord.com", "chat", "Discord"],
  ["notion.so", "notes", "Notion"],
  ["obsidian.md", "notes", "Obsidian"],
  ["docs.google.com", "gdocs", "Google Docs"],
  ["figma.com", "figma", "Figma"],
  ["linear.app", "tracker", "Linear"],
  ["atlassian.net", "tracker", "Jira"],
  ["trello.com", "tracker", "Trello"],
  ["asana.com", "tracker", "Asana"],
  ["medium.com", "blog", "Medium"],
  ["substack.com", "blog", "Substack"],
  ["nytimes.com", "news", "the New York Times"],
  ["theguardian.com", "news", "the Guardian"],
  ["bbc.co.uk", "news", "the BBC"],
  ["bbc.com", "news", "the BBC"],
  ["cnn.com", "news", "CNN"],
  ["codepen.io", "playground", "CodePen"],
  ["codesandbox.io", "playground", "CodeSandbox"],
  ["stackblitz.com", "playground", "StackBlitz"],
];

/** `docs.foo.io` is documentation even when nobody has heard of foo. */
function matchSite(host) {
  for (const [domain, key, name] of SITES) {
    if (host === domain || host.endsWith(`.${domain}`)) return { key, name };
  }
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return { key: "localhost", name: "localhost" };
  }
  if (host.startsWith("docs.")) return { key: "docs", name: "the documentation" };
  return { key: null, name: null };
}

/* ------------------------------------------------ what the page says it is */

/**
 * The tags a page publishes about itself.
 *
 * `og:` meta tags and schema.org JSON-LD are not a guess and not a scrape: they
 * are the page stating, in a machine-readable format it chose to include, what
 * it is. A shop says it is a product and gives the price. A recipe says how
 * many ingredients. An article says when it was written. That is the single
 * richest honest source available to a content script, and it costs one
 * `querySelectorAll` to read.
 */
const meta = (doc, name) =>
  doc
    .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
    ?.getAttribute("content")
    ?.trim() || "";

/** schema.org types, collapsed to the handful the animal has jokes about. */
const SCHEMA = {
  product: "product",
  recipe: "recipe",
  jobposting: "job",
  newsarticle: "article",
  article: "article",
  blogposting: "article",
  report: "article",
  videoobject: "video",
  event: "event",
  course: "course",
  movie: "movie",
  tvepisode: "movie",
  book: "book",
  musicrecording: "song",
  musicalbum: "album",
  restaurant: "place",
  localbusiness: "place",
  hotel: "place",
  softwareapplication: "app",
  person: "profile",
  profilepage: "profile",
  qapage: "question",
  question: "question",
  faqpage: "faq",
  realestatelisting: "property",
  podcastepisode: "podcast",
};

/** `og:type` says less, but far more sites bother with it. */
const OG_TYPE = {
  product: "product",
  article: "article",
  book: "book",
  profile: "profile",
};

/** Every object in a JSON-LD block, including the ones nested in `@graph`. */
function* ldNodes(doc) {
  const blocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0, 6);
  for (const block of blocks) {
    const text = block.textContent ?? "";
    // A megabyte of product feed is not worth parsing to find a price.
    if (text.length > 120000) continue;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }
    const queue = Array.isArray(data) ? [...data] : [data];
    let seen = 0;
    while (queue.length > 0 && seen < 40) {
      const node = queue.shift();
      seen += 1;
      if (!node || typeof node !== "object") continue;
      if (Array.isArray(node["@graph"])) queue.push(...node["@graph"]);
      yield node;
    }
  }
}

const asText = (v) => {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return asText(v[0]);
  if (v && typeof v === "object") return asText(v.name ?? v["@value"] ?? "");
  return "";
};

/**
 * What this page is, and the few facts about it that are worth a joke.
 *
 * Everything returned here was published by the page. Nothing is inferred and
 * nothing is filled in — a missing price is a missing price, and the lines that
 * would have quoted it simply do not exist.
 */
function readSubject(doc) {
  const out = {
    type: null,
    name: "",
    price: "",
    currency: "",
    year: 0,
    /** How long ago it was last edited, where the page says. -1 is "it does not say". */
    updatedDays: -1,
    author: "",
    rating: 0,
    votes: 0,
    ingredients: 0,
    free: true,
  };

  const ogType = meta(doc, "og:type").toLowerCase().split(".")[0];
  if (OG_TYPE[ogType]) out.type = OG_TYPE[ogType];
  else if (ogType.startsWith("video")) out.type = "video";
  else if (ogType.startsWith("music")) out.type = "song";

  out.name = meta(doc, "og:title");
  out.site = meta(doc, "og:site_name");
  out.price = meta(doc, "product:price:amount") || meta(doc, "og:price:amount");
  out.currency = meta(doc, "product:price:currency") || meta(doc, "og:price:currency");
  const ogDate = meta(doc, "article:published_time");
  if (ogDate) out.year = new Date(ogDate).getFullYear() || 0;

  for (const node of ldNodes(doc)) {
    const type = asText(node["@type"]).toLowerCase();
    if (SCHEMA[type]) out.type = SCHEMA[type];
    out.name = out.name || asText(node.headline) || asText(node.name);
    out.author = out.author || asText(node.author);
    if (node.offers) {
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      out.price = out.price || asText(offer?.price) || String(offer?.price ?? "");
      out.currency = out.currency || asText(offer?.priceCurrency);
    }
    if (node.aggregateRating) {
      out.rating = Number(node.aggregateRating.ratingValue) || out.rating;
      out.votes = Number(node.aggregateRating.ratingCount ?? node.aggregateRating.reviewCount) || out.votes;
    }
    if (Array.isArray(node.recipeIngredient)) out.ingredients = node.recipeIngredient.length;
    if (node.isAccessibleForFree === false || node.isAccessibleForFree === "False") out.free = false;
    // `datePublished` only. `dateCreated` on a page that is edited daily — a
    // wiki, a doc — is the day somebody started it, and quoting that as the age
    // of what you are reading would be false.
    const date = asText(node.datePublished);
    if (!out.year && date) out.year = new Date(date).getFullYear() || 0;
    /*
     * When it was last touched, which is the difference between an old page and
     * an abandoned one. A wiki article says it was published in 2001 and edited
     * yesterday; both are true, and only one of them is the story.
     */
    const edited = asText(node.dateModified);
    if (out.updatedDays < 0 && edited) {
      const at = new Date(edited).getTime();
      if (at > 0 && at <= Date.now()) out.updatedDays = Math.floor((Date.now() - at) / 86400000);
    }
  }

  // A year in the future, or before the web, is a broken tag rather than a fact.
  const thisYear = new Date().getFullYear();
  if (out.year < 1991 || out.year > thisYear) out.year = 0;
  out.price = /^[\d.,]+$/.test(out.price) ? out.price : "";
  return out;
}

/* --------------------------------------------------------- what it is about */

/**
 * Subjects it can recognise from the page's own headings.
 *
 * This is the fallback for the enormous majority of the web, which publishes no
 * structured data at all. It is a guess, so it is held to a stricter rule than
 * anything else in this file: a subject has to be hit by **three separate
 * words** before it is allowed to claim the page, and the lines that use it
 * quote the word and the count they found, so the animal is describing evidence
 * rather than asserting a conclusion.
 *
 * The title, the description, the headings, and the opening few thousand
 * characters of the body — which is picked up for free by the walk that counts
 * the words, so it costs nothing extra. Headings alone turned out to be far too
 * thin: a Wikipedia article's headings are "Contents" and "Taxonomy", and a
 * documentation page's are "Value" and "Examples". The subject of a page is in
 * its prose.
 */
const TOPICS = [
  ["money", ["price", "cost", "invest", "stock", "market", "salary", "revenue", "profit", "tax", "crypto", "bitcoin", "funding", "budget", "dollar", "pricing"]],
  ["shopping", ["cart", "basket", "checkout", "delivery", "shipping", "in stock", "add to bag", "sale", "discount", "order", "returns"]],
  ["food", ["recipe", "ingredients", "cook", "bake", "oven", "dinner", "restaurant", "menu", "flavour", "flavor", "chef", "kitchen"]],
  ["work", ["job", "hiring", "career", "apply", "resume", "cv", "interview", "employer", "vacancy", "recruit", "internship"]],
  ["travel", ["flight", "hotel", "booking", "destination", "airport", "itinerary", "holiday", "vacation", "trip", "tourism"]],
  ["property", ["bedroom", "mortgage", "for sale", "rent", "apartment", "landlord", "estate agent", "square feet", "listing price"]],
  ["health", ["symptom", "treatment", "diagnosis", "doctor", "patient", "clinic", "disease", "therapy", "dose", "medical"]],
  ["fitness", ["workout", "training", "muscle", "reps", "calories", "protein", "gym", "marathon", "fitness"]],
  ["code", ["install", "function", "api", "config", "error", "npm", "typescript", "python", "compile", "repository", "debug", "syntax", "server"]],
  ["ai", ["model", "prompt", "neural", "dataset", "training run", "llm", "inference", "agent", "machine learning", "gpt"]],
  ["science", ["study", "research", "hypothesis", "journal", "peer-reviewed", "experiment", "abstract", "findings", "arxiv", "doi"]],
  ["law", ["terms of service", "privacy policy", "gdpr", "liability", "consent", "agreement", "licence", "license", "compliance", "cookies"]],
  ["news", ["election", "government", "minister", "parliament", "president", "protest", "court", "police", "war", "policy"]],
  ["sport", ["match", "league", "season", "fixture", "goals", "tournament", "coach", "squad", "playoff", "score"]],
  ["gaming", ["gameplay", "walkthrough", "patch notes", "boss", "quest", "loadout", "achievement", "multiplayer", "mods", "console"]],
  ["learning", ["course", "lesson", "tutorial", "beginner", "guide", "syllabus", "exam", "certificate", "how to", "step by step"]],
  ["social", ["followers", "posted", "comments", "share", "profile", "feed", "trending", "viral", "likes"]],
  ["nature", ["species", "habitat", "wild", "predator", "mammal", "forest", "ocean", "climate", "extinct", "breeding", "reptile", "bird"]],
  ["history", ["century", "ancient", "empire", "medieval", "historian", "dynasty", "archaeolog", "civilisation", "civilization", "war of"]],
  ["technology", ["device", "battery", "screen", "processor", "gadget", "software update", "wireless", "hardware", "laptop", "smartphone"]],
  ["cars", ["engine", "mileage", "horsepower", "gearbox", "hatchback", "test drive", "dealership", "electric car", "mpg"]],
  ["entertainment", ["episode", "season finale", "cast", "director", "trailer", "box office", "streaming", "review score", "soundtrack"]],
];

function readTopic(doc, title, body) {
  const heads = Array.from(doc.querySelectorAll("h1, h2")).slice(0, 12);
  const text = [
    title,
    meta(doc, "og:description"),
    meta(doc, "description"),
    ...heads.map((h) => h.textContent ?? ""),
    body,
  ]
    .join(" ")
    .toLowerCase();
  if (text.length < 12) return { topic: null, word: "", hits: 0 };

  let best = { topic: null, word: "", hits: 0, spread: 0 };
  for (const [topic, words] of TOPICS) {
    let spread = 0;
    let word = "";
    let hits = 0;
    for (const w of words) {
      const count = text.split(w).length - 1;
      if (count === 0) continue;
      spread += 1;
      if (count > hits) {
        hits = count;
        word = w;
      }
    }
    // Three different words, not one word three times. A page that says
    // "price" repeatedly is a page with a price on it, not a page about money.
    if (spread >= 3 && spread > best.spread) best = { topic, word, hits, spread };
  }
  return best;
}

/**
 * Roughly how much text is on this page, and where the biggest heading is.
 *
 * "Roughly" is deliberate and is said out loud in the lines: the walk stops at
 * `NODE_CAP` nodes and script and style text is skipped, so on an enormous page
 * this is a floor rather than a total.
 */
function measureText(doc) {
  const root = doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;
  if (!root) return { words: 0, codeBlocks: 0, sample: "" };

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let words = 0;
  let seen = 0;
  let node = walker.nextNode();
  // The opening of the page, kept for the subject scan. Free: this walk is
  // already reading every one of these strings to count them.
  const sample = [];
  let sampled = 0;

  while (node && seen < NODE_CAP) {
    seen += 1;
    const tag = node.parentElement?.tagName;
    if (tag !== "SCRIPT" && tag !== "STYLE" && tag !== "NOSCRIPT") {
      const text = (node.nodeValue ?? "").trim();
      if (text.length > 1) {
        words += text.split(/\s+/).length;
        if (sampled < SAMPLE_CAP) {
          sample.push(text);
          sampled += text.length;
        }
      }
    }
    node = walker.nextNode();
  }

  return { words, codeBlocks: doc.querySelectorAll("pre, code").length, sample: sample.join(" ") };
}

/** The parts that only change when the URL does. Recomputed on navigation. */
function survey(doc, view) {
  const host = (view.location.hostname || "").replace(/^www\./, "");
  const path = view.location.pathname || "";
  const { key, name } = matchSite(host);
  const { words, codeBlocks, sample } = measureText(doc);

  const h1 = doc.querySelector("h1")?.textContent?.trim() ?? "";
  const title = (doc.title || "").trim();
  const inputs = doc.querySelectorAll("input, textarea, select").length;
  const sensitive = doc.querySelector("input[type='password']") !== null;
  const links = doc.querySelectorAll("a[href]").length;
  const images = doc.querySelectorAll("img").length;
  const frames = doc.querySelectorAll("iframe").length;
  const tables = doc.querySelectorAll("table").length;
  const videos = doc.querySelectorAll("video").length;
  const searching = /[?&]q=|[?&]query=|[?&]search=/.test(view.location.search) || /\/search/.test(path);
  const subject = readSubject(doc);
  const { topic, word: topicWord, hits: topicHits } = readTopic(doc, `${title} ${h1}`, sample);
  const missing = /\b(404|page not found|not found)\b/i.test(`${title} ${h1}`);

  /*
   * What kind of page this is, decided by what is on it rather than by what
   * the site is called. Order matters: the more specific a shape is, the
   * earlier it gets to claim the page.
   */
  let kind = "page";
  if (missing) kind = "error";
  // A ten thousand word article with one embedded clip in it is an article.
  // A page whose whole purpose is a video does not also carry an essay.
  else if (videos > 0 && words < 800) kind = "video";
  else if (searching) kind = "search";
  else if (codeBlocks >= 4 && words < 3000) kind = "code";
  else if (inputs >= 4 && words < 500) kind = "form";
  else if (words >= 500) kind = "article";
  else if (links >= 60) kind = "feed";
  else if (words < 60) kind = "empty";

  return {
    host,
    site: key,
    // A site nobody has heard of still has a name, and it publishes it itself.
    siteName: name || subject.site || "",
    known: Boolean(name),
    kind,
    subject,
    topic,
    topicWord,
    topicHits,
    title,
    heading: h1,
    words,
    readMinutes: Math.max(1, Math.round(words / 230)),
    codeBlocks,
    inputs,
    links,
    images,
    frames,
    tables,
    videos,
    sensitive,
    isHome: path === "/" || path === "",
  };
}

/* The last survey, and when this URL was arrived at. Both per document. */
let cache = null;
let cachedHref = "";
let arrivedAt = 0;

/**
 * Everything it can see, right now.
 *
 * Returns the remembered survey of this URL plus the handful of things that
 * change while you sit here: the clock, the scrollbar, the video.
 */
export function readPage(doc = document, view = doc.defaultView) {
  if (!view || !doc.body) return null;

  const href = view.location.href;
  if (href !== cachedHref || cache === null) {
    cachedHref = href;
    arrivedAt = Date.now();
    cache = survey(doc, view);
  }

  const el = doc.documentElement;
  const span = Math.max(0, (el?.scrollHeight ?? 0) - view.innerHeight);
  // A page that does not scroll has no scroll position to be ashamed of.
  const scrollable = span > 400;
  const scrolled = scrollable ? Math.round(Math.min(1, view.scrollY / span) * 100) : 0;

  let playing = false;
  let watched = 0;
  let runtime = 0;
  for (const v of doc.querySelectorAll("video")) {
    if (!v.paused && !v.ended && v.readyState > 2) playing = true;
    if (Number.isFinite(v.duration) && v.duration > runtime) {
      runtime = v.duration;
      watched = v.currentTime;
    }
  }

  const seconds = Math.round((Date.now() - arrivedAt) / 1000);
  return {
    ...cache,
    scrollable,
    scrolled,
    playing,
    watchedMinutes: Math.floor(watched / 60),
    runtimeMinutes: Math.floor(runtime / 60),
    seconds,
    minutes: Math.floor(seconds / 60),
    // Long enough to have read something, short enough that it is still news.
    fresh: seconds < 25,
  };
}
