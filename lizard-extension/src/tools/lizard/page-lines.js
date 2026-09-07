/**
 * What it says about the page you are actually on.
 *
 * The voice is the same one as `lines.js` — bored, interdimensional, certain
 * that some other version of you already finished this — and the same rule
 * holds it down: **every number in here was measured, in this tab, a moment
 * ago.** `page.js` counted the words, read the scrollbar and asked the video
 * how far through it is. Nothing is estimated for effect and nothing is
 * invented to fill a gap, because the animal is only allowed to be this rude
 * for exactly as long as it is never wrong.
 *
 * Two pools, both optional:
 *
 *   - `siteLines()`  — it knows this website by name. Jokes about the place.
 *   - `pageLines()`  — jokes about this specific page: its length, your scroll
 *                      position, the video, the form, the time you have been
 *                      sitting here.
 *
 * On a page with a password box on it, both return nothing at all.
 */

const plural = (n, one, many) => (n === 1 ? one : many);
const num = (n) => n.toLocaleString("en-US");
/** A thought bubble is not a text editor. */
const short = (s, max = 38) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}...` : s);
const mins = (n) => `${n} ${plural(n, "minute", "minutes")}`;
/** Currencies it can spell. Anything else keeps its three letters. */
const SYMBOL = { GBP: "£", USD: "$", EUR: "€", JPY: "¥", AUD: "$", CAD: "$" };
const money = (amount, code) => {
  if (!amount) return "";
  // A price with no pennies is a price. "1249.00" is a database field.
  const clean = amount.replace(/\.00$/, "");
  const symbol = SYMBOL[(code || "").toUpperCase()];
  return symbol ? `${symbol}${clean}` : `${clean}${code ? ` ${code}` : ""}`;
};

/* ----------------------------------------------------------- the website */

/**
 * Jokes about the place, not the page.
 *
 * Keyed on `page.site`, which several domains can share, so the GitLab jokes
 * and the GitHub jokes are the same jokes and the name is swapped in.
 */
export function siteLines(p, f) {
  const name = (f.name || "").trim() || "you";
  const site = p.siteName ?? p.host;

  switch (p.site) {
    case "youtube":
      return [
        `${site}. Infinite footage, finite ${name}. I have done that division and you are not going to like the remainder.`,
        "An algorithm somewhere just guessed what you want next, and it was right, and that should frighten you more than it does.",
        "You opened this for one video. I have been on your shoulder for the entire descent and I stopped counting.",
        "Every person in every one of these thumbnails is doing better than you and they are all pretending to be surprised about something.",
        "In one dimension you watched a tutorial and then did the thing. Wild place. The lizards there have jobs.",
      ];
    case "code-host":
      return [
        `${site}. A museum of code that nobody merged, curated by people who left.`,
        `You are reading somebody else's repository instead of writing yours, ${name}. Very brave. Very common.`,
        "Somewhere in the multiverse there is a branch of this that got finished. It is not reachable from here. I have tried.",
        "Every open pull request is a small argument that ran out of energy before it ran out of correctness.",
        "You will star this and never open it again. That is not a bookmark, that is a shrine.",
        "I have read this diff. I do not understand it. Neither do you, and only one of us is going to admit it.",
      ];
    case "stackoverflow":
      return [
        "The accepted answer is wrong, the one below it is right, and it has four votes. That is the entire profession in one screenshot.",
        `${site}. Where a stranger solved your problem in 2013 and then logged off for ever.`,
        "You are going to copy that block without reading it. It will work. Nobody, in any timeline, will ever know why.",
        "Someone marked this a duplicate. Somewhere out there, that person is having a lovely day.",
      ];
    case "reddit":
    case "hackernews":
      return [
        `${site}. Strangers arguing, sorted by popularity. I have visited many dimensions and this is what the species does with a network in every single one.`,
        "Nobody here has read the article. You have not read the article. I am a lizard and I have not read the article.",
        "The top comment is a joke and the correct answer is nine replies down with a score of two. As it should be.",
        `You came here for two minutes, ${name}. That was a lie you told a reptile.`,
      ];
    case "x":
      return [
        `${site}. A feed with no bottom, on purpose. I have infinite time and even I gave up looking for one.`,
        "Somebody is wrong on this website and you have decided that it is your problem now.",
        "Each of these was typed by a real person, in a real room, instead of doing something.",
        "This is the fastest available way to feel informed while learning nothing. Genuinely impressive engineering.",
      ];
    case "feed":
      return [
        `${site}. Your thumb is doing the only cardio in this house.`,
        "This is engineered to be exactly as good as it needs to be to keep you here, and not one atom better.",
        "Everyone in this feed is on holiday and nobody is at work, and that is statistically impossible, so somebody is lying.",
        "I could scroll this. I have no thumbs and I still could. That is what I mean about the design.",
      ];
    case "wikipedia":
      return [
        `${site}. You arrived for one fact and you are now four links deep into a village in Estonia. I respect the mechanism. Not you, the mechanism.`,
        "This was written for free by someone at three in the morning. That is the best thing your species has ever done and it is not close.",
        "Citation needed. On this page, on your plans, on most of what you said this week.",
      ];
    case "search":
      return [
        `You typed a question into a box owned by a company, ${name}. In another timeline you just tried it and found out in nine seconds.`,
        "The first four results are advertisements and you are going to click one anyway.",
        "You have searched for a version of this before. I was there. It went nowhere then, too.",
      ];
    case "mail":
      return [
        `${site}. A queue of other people's priorities, formatted to look like yours.`,
        "You will read that one, feel bad, close it, and leave it unread so the bad feeling stays available.",
        "Nobody has ever reached the bottom of one of these and stayed there. It is a treadmill with a font.",
        "Somewhere a version of you declared inbox bankruptcy and moved to a boat. I check in on him. He is fine.",
      ];
    case "shopping":
      return [
        `${site}. You are about to buy something to solve a problem you could solve by standing up.`,
        "It will arrive, you will be pleased for eleven minutes, and then it will live in a drawer with the others.",
        "Read the one-star reviews. They are the only honest writing on this entire website.",
        `You do not want the object, ${name}. You want the version of yourself who owns it. He is not in stock.`,
      ];
    case "streaming":
      return [
        `${site}. Two hours of choosing is still an evening, technically.`,
        "You have seen this menu more times than you have seen most of your friends.",
        "Pick anything. Watch nothing. Fall asleep. It is a ritual now and I have stopped judging it. That was a lie, I have not.",
      ];
    case "twitch":
      return [
        "You are watching a person do a thing you could be doing. There is a word for that and the word is 'evening'.",
        "The chat is moving faster than any human can read, and everyone in it believes they are participating.",
      ];
    case "music":
      return [
        "Music to focus with, on a page that is not the work. The focus has nowhere to land.",
        "You have adjusted the soundtrack of doing nothing. Beautifully. Genuinely, the vibe is immaculate and the output is zero.",
      ];
    case "linkedin":
      return [
        `${site}. Everybody here is thrilled to announce something, and nobody here is happy.`,
        "In one dimension somebody posted the plain truth on this website and the servers caught fire.",
        "Nobody's job is going that well. I have been to those offices. I live in a wall.",
      ];
    case "docs":
      return [
        `You are reading ${site}. Genuinely startling. I will wait here while you close it and go back to guessing.`,
        "The answer is on this page. It has been on this page the whole time. It was on this page yesterday when you asked a chatbot instead.",
        "Documentation: written by people who understood it, for people who do not, and read by nobody in between.",
      ];
    case "npm":
      return [
        "You are about to install eleven hundred packages so you do not have to write nine lines.",
        "Last published four years ago. That is either abandoned or finished, and there is no way to tell from here, ever.",
      ];
    case "ai":
      return [
        `${site}. You are asking a language model to do it. Between the three of us — it, me, and you — you are the bottleneck, ${name}.`,
        "It will answer instantly and confidently and you will not check it. That is your half of this arrangement.",
        "I am a drawn lizard and that is a trillion-parameter model, and we are both employed here for exactly the same reason: you did not want to be alone with the task.",
        "Ask it something hard. Go on. I want to see if it burps.",
      ];
    case "meeting":
      return [
        "A meeting. Several adults watching each other decide not to talk. I do that professionally, for free, in a wall.",
        "This could have been an email. The email could have been nothing. Nothing was the correct amount.",
        "Everyone is on mute and someone is about to say 'sorry, you go'. I have watched this in nine hundred timelines and it always happens.",
      ];
    case "chat":
      return [
        `${site}. Unread badges. You will clear them, feel something for eleven seconds, and they will grow back like a tail.`,
        "Somebody typed 'quick question' and it has been forty minutes.",
        "Three people are typing. None of them are deciding anything.",
      ];
    case "notes":
    case "gdocs":
      return [
        "A document. Empty documents are the purest form of your ambition, and the most common.",
        "You will reorganise the headings instead of writing under them. I have seen this. I know what this is.",
        `Writing about the work is not the work, ${name}. It is close enough to feel like it, which is why it is so dangerous.`,
      ];
    case "figma":
      return [
        "You have moved that rectangle four pixels. It was correct before. It is correct now. Nothing has happened.",
        "Twelve versions of the same screen, and the one you will ship is the second one, which you made in an hour, in a good mood.",
      ];
    case "tracker":
      return [
        `${site}. Where work goes to be described in detail instead of done.`,
        "Dragging a card is not progress. It is the feeling of progress, in a colour you chose.",
        "Every ticket on this board was a good mood once. Look at them now.",
      ];
    case "blog":
    case "news":
      return [
        `${site}. Same events, new dates, worse mood.`,
        "Nothing on this page requires anything from you, and that is exactly why you are reading it.",
        "You will remember none of this by Thursday. That is not an insult, it is just how the format works.",
      ];
    case "playground":
      return [
        "A sandbox. The only place where your code both works and matters to nobody.",
        "You are prototyping. That is the fun half. The other half is why the tab behind this one has been open since March.",
      ];
    case "localhost":
      return [
        "localhost. The only server in the universe that likes you, and you are about to break it again.",
        `Nobody can see this but you and me, ${name}, and one of us is not impressed.`,
        "It works here. That sentence is the beginning of every disaster I have ever witnessed, in any dimension.",
        "Port numbers. You have an entire second life on this machine that nobody will ever visit.",
      ];
    default:
      return [];
  }
}

/* -------------------------------------------------------------- this page */

/**
 * Jokes about the specific page under its feet.
 *
 * Everything here is built from a measurement, so a line only exists when the
 * thing it describes is true right now: a scroll line needs a page that
 * scrolls, a video line needs a video that is playing, a word-count line needs
 * words that were actually counted.
 */
export function pageLines(p, f) {
  const name = (f.name || "").trim() || "you";
  const out = [];

  /* --- what it is ------------------------------------------------------- */
  if (p.title) {
    out.push(`This page calls itself "${short(p.title)}". Ambitious. I have read it and it does not.`);
  }
  if (p.heading && p.heading !== p.title) {
    out.push(`"${short(p.heading)}", in the biggest letters on the page, because somebody was worried you would leave.`);
  }

  /* --- how much of it there is ------------------------------------------ */
  if (p.words >= 400) {
    out.push(
      `About ${num(p.words)} words below me. ${mins(p.readMinutes)} of reading. You have got ${mins(p.minutes)} in you and we both know it.`,
    );
    out.push(
      `${mins(p.readMinutes)} of text. In that time I could catch six flies, dig a tunnel, and form a settled opinion of you. I have already done the last one.`,
    );
  }
  if (p.words >= 2000) {
    out.push(
      `${num(p.words)} words. Somebody wrote all of that, alone, hoping. And here you are, ${name}, watching a lizard walk across it.`,
    );
  }

  /* --- how far down it you are ------------------------------------------ */
  if (p.scrollable) {
    if (p.scrolled === 0 && p.seconds > 45) {
      out.push(
        `${mins(p.minutes)} on this page and you have not scrolled once. Same rectangle. Same lizard. Nothing moving anywhere in the observable universe.`,
      );
    } else if (p.scrolled >= 96) {
      out.push(
        "You reached the bottom of the page. That is the smallest unit of achievement the internet offers and you should take it, honestly, today.",
      );
    } else if (p.scrolled > 0 && p.scrolled < 30 && p.words >= 600) {
      out.push(
        `${p.scrolled}% down. There is ${100 - p.scrolled}% of this left and I can already feel you reaching for the tab bar.`,
      );
    } else if (p.scrolled >= 30) {
      out.push(`${p.scrolled}% of the way down. Further than usual. I have made a note. Nobody reads my notes.`);
    }
  }

  /* --- the clock -------------------------------------------------------- */
  if (p.minutes >= 3) {
    out.push(
      `${mins(p.minutes)} on this one page, ${name}. I did not start the timer to be cruel. I started it because I was curious. It became cruel on its own.`,
    );
  }
  if (p.minutes >= 12) {
    out.push(
      `Twelve minutes ago you opened this to check one thing. I have watched entire species do more with less time.`,
    );
  }
  if (p.fresh) {
    out.push("New page. Same person. Nothing structural has changed.");
    out.push("You just arrived somewhere else. I moved with you. That is the arrangement now, and you never signed anything.");
  }

  /* --- what kind of page it is ------------------------------------------ */
  switch (p.kind) {
    case "video":
      if (!p.playing) out.push("A paused video. Frozen mid-sentence, like the rest of your afternoon.");
      out.push("A page built around one moving rectangle, and forty people were paid to make it.");
      break;
    case "code":
      out.push(
        `${p.codeBlocks} blocks of code on this page. You are going to copy one without reading it and it is going to work, and that is the horror.`,
      );
      out.push("Code, on a page, doing nothing. Same as the code in your editor, to be fair.");
      break;
    case "form":
      out.push(
        `${p.inputs} empty boxes under my feet. Fill one in. I want to see whether you can finish anything at all today.`,
      );
      out.push("A form. Somebody designed this to be exactly annoying enough that you would give up, and it is working.");
      break;
    case "search":
      out.push("Search results. The answer is somewhere on this page and you are going to search again instead.");
      break;
    case "error":
      out.push(
        "This page does not exist, and yet here we both are, standing on it. Most honest thing this website has ever done.",
      );
      out.push("A dead link. In some dimension this page loaded fine and everything went differently for you.");
      break;
    case "empty":
      out.push("There is almost nothing on this page. Beautiful. No demands. I could live here.");
      break;
    case "feed":
      out.push(`${num(p.links)} links on this page. ${num(p.links)} directions, and you will pick the one that leads back here.`);
      break;
    default:
      break;
  }

  /*
   * A video playing is worth saying wherever it is playing, which is very often
   * not on a page that is about the video.
   */
  if (p.playing) {
    out.push(
      p.runtimeMinutes > 0
        ? `${mins(p.watchedMinutes)} into ${mins(p.runtimeMinutes)}. Something is playing and nobody in this room is watching it.`
        : "Something is playing behind me and you are reading a lizard instead. Two machines running, zero output between them.",
    );
  }

  /* --- the furniture ---------------------------------------------------- */
  if (p.images >= 40) {
    out.push(`${num(p.images)} images on this page. ${num(p.images)} decisions somebody agonised over, scrolled past in four seconds.`);
  }
  if (p.frames >= 3) {
    out.push(
      `${p.frames} embedded frames on this page, all of them watching you. I am the only thing here that admits it.`,
    );
  }
  if (p.tables >= 1 && p.kind !== "feed") {
    out.push("A table. Numbers in a grid, which is how your species makes a guess look like a fact.");
  }
  if (p.isHome && p.siteName) {
    out.push(`The front page of ${p.siteName}. You did not come here for anything specific. You came here out of muscle memory.`);
  }
  /*
   * A site it has no jokes written about is still a site with a name, because
   * pages publish their own. Not knowing a place has never once stopped it
   * having an opinion about the place.
   */
  if (!p.known) {
    if (p.siteName) {
      out.push(`${p.siteName}. A website I know nothing whatsoever about, which puts me exactly level with you.`);
    }
    out.push(`${p.host}. Somebody registered that, meant it at the time, and this is where it ended up.`);
  }

  return out;
}

/* ------------------------------------------------- what the page says it is */

/**
 * Jokes about the thing on the page, not the page.
 *
 * Everything here comes out of tags the page published about itself — `og:`
 * meta and schema.org JSON-LD — so a price is the price the shop typed, a date
 * is the date the article claims, and a rating is the number the site is
 * already showing you. Where a tag is missing, the line that would have quoted
 * it does not exist, which is why there is a `if` in front of nearly all of it.
 */
export function subjectLines(p, f) {
  const name = (f.name || "").trim() || "you";
  const s = p.subject ?? {};
  const it = s.name ? `"${short(s.name)}"` : "This";
  const cost = money(s.price, s.currency);
  const out = [];

  if (s.rating > 0 && s.votes > 0) {
    out.push(
      `Rated ${s.rating} out of 5 by ${num(s.votes)} people who each felt strongly enough about this to fill in a form.`,
    );
  }
  if (!s.free) {
    out.push(
      "There is a paywall on this. Somebody wants money for the middle of it. Read the headline and invent the rest, that is what everyone else does.",
    );
  }

  switch (s.type) {
    case "product":
      if (cost) {
        out.push(
          `${it}. ${cost}. You do not want the object, ${name}. You want the version of yourself who owns it, and he is not in stock.`,
        );
        out.push(`${cost}. Somebody chose that number specifically to be almost fine.`);
      }
      out.push("A shop, dressed as a page. Every pixel here is a small argument for spending money.");
      out.push(
        `${it} will arrive, you will be pleased for eleven minutes, and then it will live in a drawer with the others.`,
      );
      break;
    case "recipe":
      if (s.ingredients > 0) {
        out.push(
          `${s.ingredients} ingredients. You have four of them. You are going to attempt it anyway and it will be fine.`,
        );
        out.push(
          `About ${num(p.words)} words on this page for ${s.ingredients} ingredients. Somewhere in there is a story about a grandmother.`,
        );
      }
      out.push("A recipe. You will read it, feel fed, and then eat something else standing up at the counter.");
      break;
    case "job":
      out.push(
        `A job posting. You are not going to apply, ${name}. You are going to read the salary, feel something, and close the tab.`,
      );
      out.push(`${it}. They want six years of experience in a thing that has existed for four.`);
      out.push('Somebody typed "fast-paced environment" and meant "nobody here is coping".');
      break;
    case "article": {
      const age = s.year > 0 ? new Date().getFullYear() - s.year : 0;
      const edited =
        s.updatedDays < 0
          ? ""
          : s.updatedDays < 1
            ? "today"
            : s.updatedDays === 1
              ? "yesterday"
              : `${s.updatedDays} days ago`;
      // Old and still being edited is not the same thing as old and abandoned,
      // and calling the first one dead would be a lie.
      if (age >= 2 && edited && s.updatedDays <= 30) {
        out.push(
          `Started in ${s.year} and edited ${edited}. ${age} years of strangers correcting each other and it is still not finished. I respect that more than anything you have made.`,
        );
      } else if (age >= 3) {
        out.push(`Published in ${s.year}. That is ${age} years ago. You are taking advice from a dead internet.`);
      } else if (s.year > 0) {
        out.push(`Written in ${s.year}, which makes it new, which is the only quality anything here is judged by.`);
      }
      // "Contributors to Wikimedia projects" is not somebody who moved on.
      if (s.author && s.author.length <= 28) {
        out.push(`${s.author} wrote this, and has since moved on and would not defend a word of it.`);
      }
      out.push(
        `Somebody's whole week, about ${num(p.words)} words, and you will read the first paragraph and the last line.`,
      );
      break;
    }
    case "event":
      out.push("An event, with a date on it. You will not go. You have never gone.");
      break;
    case "course":
      out.push(
        "A course. Buying a course is the feeling of learning, at a price, without the risk of discovering you cannot.",
      );
      break;
    case "movie":
      out.push("Reading about a film is faster than watching one, and you have optimised entirely for speed.");
      break;
    case "book":
      out.push("A book. The slowest available way to be told something, which is precisely why it works.");
      break;
    case "song":
    case "album":
      out.push("You are choosing the soundtrack for a task you have not started.");
      break;
    case "place":
      out.push("A real place, with an address, that you could physically walk to. Radical.");
      break;
    case "app":
      out.push(
        "Software. Installing it is the fun part. Opening it again next Tuesday is the part that never happens.",
      );
      break;
    case "profile":
      out.push(
        "A person's own summary of themselves. That is a work of fiction with a photograph attached, and you are reading it closely.",
      );
      break;
    case "question":
      out.push("A question, asked by somebody who solved it four minutes later and never came back to say how.");
      break;
    case "faq":
      out.push(
        "Frequently asked questions, none of which anybody asked. Written by the company, answered by the company.",
      );
      break;
    case "property":
      out.push("A property listing. Look at the price. Look at the room. Look at the price again.");
      break;
    case "podcast":
      out.push("Two hours of people talking. You will hear eleven minutes of it in the shower.");
      break;
    default:
      break;
  }
  return out;
}

/* --------------------------------------------------------- what it is about */

/**
 * Jokes about the subject, on a page that published nothing about itself.
 *
 * This is the only pool in the extension built on an inference rather than a
 * measurement, so it carries its evidence: `page.js` will not name a subject
 * until three separate words have hit it, and the first line here quotes the
 * word it found and how many times it found it. The animal is describing what
 * is written in front of it, which it can see, rather than claiming to know
 * what the page means, which it cannot.
 */
export function topicLines(p) {
  if (!p.topic) return [];
  const out = [];
  // Said once, a word is a coincidence. The line that quotes a count only
  // exists when the count is worth quoting.
  if (p.topicHits >= 2) {
    out.push(
      `The word "${p.topicWord}" is on this page ${p.topicHits} times. I know exactly what this is, and so do you.`,
    );
  }

  switch (p.topic) {
    case "money":
      out.push("Money. Every page about money is really a page about somebody else having more of it.");
      out.push("A number goes up, a number goes down, and a species that could have been doing anything watches it.");
      break;
    case "shopping":
      out.push("A shop. Everything on this page was arranged by somebody whose entire job is your wallet.");
      break;
    case "food":
      out.push("Food. You are hungry. That is the whole content of this page as far as your body is concerned.");
      break;
    case "work":
      if (p.topicHits >= 2) {
        out.push(`Jobs. The word "${p.topicWord}" is on here ${p.topicHits} times and not one of them is yours yet.`);
      }
      out.push("Somewhere out there is a version of you who took the other offer. He is also reading a page like this.");
      break;
    case "travel":
      out.push("Travel. The best part of a trip is this bit, the planning, and you know it, which is why you are still here.");
      break;
    case "property":
      out.push("Houses. Looking at rooms you will never live in is the cheapest hobby on the internet.");
      break;
    case "health":
      out.push("Whatever you were worried about, a page like this will hand it back to you as a worse thing.");
      break;
    case "fitness":
      out.push("Reading about exercise is not exercise, and the distance between the two is an entire industry.");
      break;
    case "code":
      out.push("Somewhere on this page is the one line you need, surrounded by nine hundred that you do not.");
      out.push("Programming. You are not stuck on the hard part. You are stuck on a setting.");
      break;
    case "ai":
      out.push(
        "You are reading about a machine that could be doing this for you, instead of having it do this for you.",
      );
      break;
    case "science":
      out.push("Research. One finding, and forty hedges arranged carefully around it.");
      break;
    case "law":
      out.push("Terms and conditions. Nobody has read these. Not one person, in the entire history of the document.");
      break;
    case "news":
      out.push("You will finish this page angrier and no better informed. That is the product working correctly.");
      break;
    case "sport":
      out.push("Grown adults, sorted into teams, and you have decided that one of them is somehow yours.");
      break;
    case "gaming":
      out.push(
        "Games. A hobby with a to-do list in it, which is why you are excellent at this one and hopeless at the other.",
      );
      break;
    case "learning":
      out.push(
        "A tutorial. Reading one is not learning, it is watching somebody else learn, which is far more comfortable.",
      );
      break;
    case "social":
      out.push("Other people, curated by themselves, ranked by a machine. Enjoy.");
      break;
    case "nature":
      out.push(
        "Animals. I am an animal. I want you to know that I have read what your species writes about us and I have notes.",
      );
      out.push("Every creature on this page is better at being alive than you are, and none of them are trying.");
      break;
    case "history":
      out.push("History. Everybody on this page is dead and none of them finished their list either.");
      out.push("They had empires, plagues and no dentistry, and they still got more done before lunch.");
      break;
    case "technology":
      out.push("A device. It will be obsolete in four years and you will be sad about it, which is the business model.");
      break;
    case "cars":
      out.push("A car. A machine for sitting still in, at scale, with everyone else.");
      break;
    case "entertainment":
      out.push("Reading about the thing takes less courage than watching it, and far less than making one.");
      break;
    default:
      break;
  }
  return out;
}

/**
 * Everything it can honestly say about where it is, or nothing.
 *
 * A password box on the page empties both pools. What you are doing there is
 * not the lizard's business, and a joke about it would not be funny.
 */
export function contextLines(p, f) {
  if (!p || p.sensitive) return [];
  return [...siteLines(p, f), ...subjectLines(p, f), ...topicLines(p), ...pageLines(p, f)];
}
