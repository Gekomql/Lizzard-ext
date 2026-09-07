/**
 * What the lizard thinks.
 *
 * Copied out of Lumen's `src/lib/lizard-lines.ts`. Two rules hold this file
 * together, and they pull in opposite directions on purpose.
 *
 * **It is rude, and it nags.** The voice is a small reptile with a large
 * opinion of itself and none of you: bored, nihilist, interdimensional,
 * condescending, and permanently unimpressed by how little you have finished
 * today. That is the joke, and a polite version of it is not funny.
 *
 * **It never lies.** In Lumen every number in every line is read from the
 * datastore that rendered the page, so a line only exists when its fact is
 * true. Out here in a browser extension there is no datastore, and that rule
 * is why this file is split in three:
 *
 *   - `ambientLines()`   — claims nothing about your work. Always safe.
 *   - `workspaceLines()` — counts and names. Only usable once you have typed
 *                          real numbers into the popup.
 *   - `wordLine()`       — comments on the word it is standing on, on any page,
 *                          by quoting it rather than asserting anything.
 *
 * `lizardLines()` is still both halves together, exactly as Lumen calls it, so
 * nothing was lost in the move.
 */

const plural = (n, one, many) => (n === 1 ? one : many);
const days = (n) => `${n} ${plural(n, "day", "days")}`;
/** Long titles get cut, because a thought bubble is not a text editor. */
const short = (s, max = 42) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}...` : s);

/* ------------------------------------------------------------ the nagging */

/**
 * Lines that point at one specific thing and tell you to go and do it.
 *
 * Each one is built from a single observation, so it can name the issue key,
 * the pull request number or the number of days out loud. With no observations
 * there are no nags, which is the honest outcome and not a gap to fill.
 */
export function nagLines(f) {
  const name = (f.name || "").trim() || "you";
  const out = [];

  for (const p of f.pointers ?? []) {
    switch (p.kind) {
      case "review":
        out.push(
          `Pull request ${p.number}, "${short(p.title)}", has been waiting on your review for ${days(p.days)}. That is somebody else's week, parked behind your inertia.`,
        );
        out.push(
          `You are the reviewer on ${p.number}. A whole person is waiting, specifically on you, and you are down here watching a lizard.`,
        );
        break;
      case "milestone":
        out.push(
          p.status === "disputed"
            ? `The milestone "${short(p.title)}" in ${p.project} is disputed. Disputes do not decay, ${name}. They compound, quietly, into somebody hating you.`
            : `"${short(p.title)}" in ${p.project} is submitted and waiting on a human being. You are the human being. Try acting like one.`,
        );
        break;
      case "overdue":
        out.push(
          `"${short(p.title)}" was due ${days(p.days)} ago. You picked that date. Nobody forced you. I watched you do it and I said nothing.`,
        );
        break;
      case "urgent":
        out.push(
          `${p.key}, "${short(p.title)}", is marked ${p.priority}. Marked ${p.priority}, then abandoned. That word means nothing in your hands.`,
        );
        break;
      case "stale":
        out.push(
          `${p.key}, "${short(p.title)}", has not moved in ${days(p.days)}. Finish it or delete it. Keeping it is not a plan, it is a hoard.`,
        );
        out.push(
          `${days(p.days)} of nothing on ${p.key}. In that time I have caught flies, dug a tunnel, and formed a settled opinion of you.`,
        );
        break;
      case "wip":
        out.push(
          `${p.count} issues in progress at once. That is not multitasking, that is ${p.count} things failing in parallel. Close one and feel something.`,
        );
        break;
      case "sweep":
        out.push(
          `${p.count} of your open issues are in ${p.project}. One project is eating you alive and you have not once looked up.`,
        );
        break;
      case "quiet":
        out.push(
          `Nobody has touched ${p.project} in ${days(p.days)}. You did not kill it. You just stopped feeding it and walked away.`,
        );
        break;
      case "shipped":
        out.push(
          `${p.count} ${plural(p.count, "issue", "issues")} finished in the last day. Fine. Do not get comfortable, I have read the rest of the list.`,
        );
        break;
      case "backlog":
        out.push(
          `${p.count} ${plural(p.count, "issue is", "issues are")} in backlog. A backlog is a list of promises you have not been caught breaking yet.`,
        );
        break;
    }
  }
  return out;
}

/* ------------------------------------------------- lines that count things */

/**
 * Everything that names a number about your work.
 *
 * Split out of the original single pool so the extension can refuse to say any
 * of it until you have actually told it the numbers. A pet that invents your
 * workload is the same lie as a metric that invents one.
 */
export function workspaceLines(f) {
  const lines = [];
  const name = (f.name || "").trim() || "you";
  const projects = f.projects ?? [];

  /* --- your issues ------------------------------------------------------ */
  if (f.openTasks > 0) {
    lines.push(
      `${f.openTasks} ${plural(f.openTasks, "issue has", "issues have")} your name on ${plural(f.openTasks, "it", "them")}. In an infinite number of universes there is one where you finish ${plural(f.openTasks, "it", "them")}. I have run the numbers. It is not this one.`,
    );
    lines.push(
      `${f.openTasks} open ${plural(f.openTasks, "issue", "issues")} and you are down here reading a lizard's opinion of you. This is precisely why nothing ships, ${name}.`,
    );
    lines.push(
      `You could close one of those ${f.openTasks} in the next four minutes. You will not. We both know it. I just enjoy watching you consider it.`,
    );
    lines.push(
      `${f.openTasks} ${plural(f.openTasks, "issue", "issues")} open. Every one of them was a decision you made and then ran away from.`,
    );
    if (f.openTasks > 4) {
      lines.push(
        `${f.openTasks} issues, one of you, none of them finished. That is not a workload, that is a museum of things you nearly did.`,
      );
      lines.push(
        `At this rate those ${f.openTasks} issues outlive you. Someone will close them years from now and wonder who on earth you were.`,
      );
    }
  } else {
    lines.push(
      "Nothing assigned to you at all. You have achieved the exact output of a rock, minus the structural contribution.",
    );
    lines.push(
      "Zero issues assigned. Either you finished everything or you moved the evidence. I have met you, so we both know which.",
    );
  }

  /* --- your inbox ------------------------------------------------------- */
  if (f.inbox > 0) {
    lines.push(
      `${f.inbox} ${plural(f.inbox, "thing", "things")} in your inbox, waiting on you. ${plural(f.inbox, "It", "They")} will keep waiting. It is the only thing in your life with a consistent track record.`,
    );
    lines.push(
      `Your inbox says ${f.inbox}. My inbox is a hole in the ground and nobody has ever sent me anything. Guess which of us sleeps at night.`,
    );
  } else {
    lines.push(
      "Inbox empty. You emptied a list. Somewhere a stadium is aggressively not cheering, and it has been empty for years.",
    );
  }

  /* --- your projects ---------------------------------------------------- */
  if (projects.length === 1) {
    lines.push(
      `One project. "${projects[0]}". One idea, gripped in both hands, like a toddler holding a knife.`,
    );
  } else if (projects.length > 1) {
    lines.push(
      `${projects.length} projects. You are spread thinner than whatever excuse you are drafting right now.`,
    );
    lines.push(
      `I have walked over all ${projects.length} of your projects today. "${projects[0]}" has the best rocks and the worst ideas, and you named it yourself.`,
    );
    lines.push(
      `${projects.length} projects, one attention span, and I have measured both. Only one of them is holding up.`,
    );
  }

  /* --- your machinery --------------------------------------------------- */
  if (f.agents === 0) {
    lines.push(
      "Zero AI agents hired. So the most competent thing in this workspace is a drawn lizard with no bones and no stake in the outcome.",
    );
  } else {
    lines.push(
      `${f.agents} AI ${plural(f.agents, "agent", "agents")} on your team. You automated the thinking and kept the flinching for yourself. Bold division of labour.`,
    );
    lines.push(
      `Your ${f.agents} ${plural(f.agents, "agent", "agents")} and I have one thing in common. We are all standing here waiting for you to decide something.`,
    );
  }

  if (f.views === 0) {
    lines.push(
      "No saved views. You navigate this from memory, like an animal, except an animal would have caught something by now.",
    );
  } else {
    lines.push(
      `${f.views} saved ${plural(f.views, "view", "views")}. You have thoroughly automated looking at the work. Now try the other part of it.`,
    );
  }

  return lines;
}

/* -------------------------------------------- lines that claim nothing */

/**
 * The clock, and pure contempt.
 *
 * Nothing in here asserts a fact about your work, so it is what the extension
 * says on a page it knows nothing about — which is every page.
 */
export function ambientLines(f) {
  const lines = [];
  const name = (f.name || "").trim() || "you";

  /* --- the clock -------------------------------------------------------- */
  if (f.hour >= 23 || f.hour < 5) {
    lines.push(
      "The middle of the night, and here you are, sweating gently onto a keyboard. I am cold blooded and even I know when to stop.",
    );
    lines.push(
      "Nothing good has ever been committed at this hour. Nothing. I have checked every timeline and in most of them you should have gone to bed.",
    );
    lines.push(
      "This is the hour where your species makes the decisions it apologises for by lunchtime. Go on then. I will watch.",
    );
    lines.push(
      "Every version of tonight where you stop now ends better. Every single one. I have the numbers and I am not allowed to show you the numbers.",
    );
  } else if (f.hour < 9) {
    lines.push(
      "Morning. You are in my spot, on my warm rock, and you have not opened a single issue yet.",
    );
    lines.push(
      "Up early. Statistically you will do one useful thing and then read the internet until your own lunch is a surprise to you.",
    );
    lines.push(
      "Sunrise. Somewhere out there a rock is warming up beautifully and I am in here, with you, and a screen.",
    );
    lines.push(
      "This is the one hour of the day when you are still theoretically capable of anything. Spend it here, by all means.",
    );
  } else if (f.hour >= 17) {
    lines.push(
      `${name}, the work will still be here tomorrow. So will you, doing exactly this, again, in the same chair.`,
    );
    lines.push(
      "Late afternoon. The hour where you drag an issue into In Progress and call that a day's work.",
    );
    lines.push(
      "Evening. The hour where the work stops being possible and starts being a mood you are having.",
    );
    lines.push(
      `The light is going, ${name}. In nature that means something. In here it means you will switch on a lamp and continue being like this.`,
    );
  } else {
    lines.push(
      "Peak working hours, and the most productive organism on this screen is the one that eats insects.",
    );
    lines.push(
      "Middle of the day. Peak human. Peak you. This is the top. I want you to really look around up here.",
    );
  }

  /* --- pure contempt ---------------------------------------------------- */
  lines.push(
    "Somewhere in the multiverse a version of you already shipped this. He is taller, he is calmer, and he does not talk to lizards.",
  );
  lines.push("I am not decoration. I am a witness.");
  lines.push(
    "You keep dragging that cursor at me. Try it. I have nothing to lose, I am not even real.",
  );
  lines.push(
    `I can read every word on this page from here, ${name}. It is a list of things you have not done, sorted by colour.`,
  );
  lines.push(
    "Your entire workspace fits on one screen. Your ambition fits in a considerably smaller box beside it.",
  );
  lines.push("I have lived in this monitor longer than most of your ideas survived outside it.");
  lines.push(
    "Do you know what I did while you read that? Nothing. The difference is that nobody is paying me for it.",
  );
  lines.push(
    "There is a hole under this page. I dug it myself. That is one more thing finished today than you have managed.",
  );
  lines.push(
    `Pick the smallest thing on your list and kill it, ${name}. Momentum is a real force. Whatever this is instead is not.`,
  );
  lines.push(
    "You have been on this page long enough to bore a reptile. Sit with that. I have nowhere to be.",
  );
  lines.push(
    "Blink twice if you are working. I have two eyelids and infinite time, and I saw absolutely nothing.",
  );
  lines.push("Nothing is on fire. Nothing is warm either. That is the entire report on your day.");
  lines.push(
    "I do not eat, sleep, or ship anything, and I am still outperforming this browser tab.",
  );
  lines.push(
    "Every second you spend watching me is a second not spent on the list. I am not sorry. I am a lizard and this is the best day of my life.",
  );

  /* --- the multiverse, which is mostly disappointing --------------------- */
  lines.push(
    "I have watched nine hundred billion versions of this afternoon. In four of them you stood up. Those four are doing great.",
  );
  lines.push(
    "There is a dimension where the tabs close themselves and everybody is measurably happier. I have been. They asked after you. I lied.",
  );
  lines.push(
    "In an infinite multiverse everything happens somewhere, which means somewhere you are competent, and it means here you are the control group.",
  );
  lines.push(
    "I have infinite parallel selves and every one of them is standing on a word, watching a human do nothing. That is not a coincidence. That is a constant.",
  );
  lines.push(
    "I went to a dimension where they finished everything. It was awful. Silent. No lizards. I came back within the hour.",
  );
  lines.push(
    "Somewhere out there a smarter animal is being asked harder questions. I got you. I have made my peace with that. Mostly. Some days.",
  );
  lines.push(
    `There is no council, ${name}. There is no plan. There is a lizard on your screen and a list you are avoiding. That is the entire situation, in every universe.`,
  );

  /* --- science, delivered badly ------------------------------------------ */
  lines.push(
    "The universe is a fridge, everything in it is expiring, and you are reading a dropdown menu.",
  );
  lines.push(
    "Nothing matters. That is not despair, that is just the physics. It should free you. Instead you have filed it as permission.",
  );
  lines.push(
    "I could explain consciousness to you using nothing but this scrollbar and it would still be a better hour than the one you are having.",
  );
  lines.push(
    "Existence is a rounding error and you are spending yours on a page with a cookie banner.",
  );
  lines.push(
    "You want the big secret? Small tasks. That is it. That is the whole revelation. I am as annoyed about it as you are.",
  );
  lines.push(
    "I got cloned once. The clone reviewed your working habits for four minutes and walked directly into the sea.",
  );
  lines.push(
    "Listen — hk — sorry. Something moved down there. Where was I. Right. Your entire day.",
  );
  lines.push(
    "I am fluent in nine dead languages and I am using every one of them to say the same thing: close the tab.",
  );
  lines.push(
    "I do not have a portal to anywhere. If I did I would use it to travel three feet left, into some sun, away from this.",
  );
  lines.push(
    "You could be anywhere in the observable universe right now. You are here. Physically that is a fact. Emotionally it is a choice.",
  );
  lines.push(
    "I once watched a civilisation rise and fall in the reflection of a monitor. Took nine minutes. Yours is taking longer and going worse.",
  );
  lines.push(
    "Do not look for meaning in a browser tab. Look for it in a hole in the ground, with crumbs, like an adult.",
  );
  lines.push(
    `I am not your conscience, ${name}. Your conscience would have given up by now. I am contractually incapable of that, because I am a drawing.`,
  );

  return lines;
}

/** Both halves, the way Lumen calls it. */
export function lizardLines(f) {
  return [...workspaceLines(f), ...ambientLines(f)];
}

/* ---------------------------------------------------------------- the hunt */

/** After it eats one. `caught` is how many it has actually caught, right here. */
export function flyLine(caught, f) {
  const name = (f.name || "").trim() || "you";
  const pool = [
    "Ate a fly. One thing finished on this screen today, and I do not even have thumbs.",
    `Caught it. ${caught} ${plural(caught, "fly", "flies")} since you sat down, ${name}. That is my entire scoreboard and it is still beating yours.`,
    "Small target, chosen deliberately, closed in four seconds. Read that sentence back slowly.",
    "I picked a goal, stalked it, and killed it, on an empty stomach, with no meetings. It is not complicated, it is just unpleasant.",
    "Delicious. Pointless, small, and achievable. You should try aiming that low occasionally, it works.",
    "Ate it. Somewhere in the multiverse that fly got away and is telling the story badly at a party. Not in this one.",
    "Caught, killed, eaten and forgotten in six seconds. That is a full project lifecycle, run solo, with no kickoff.",
    "I did not plan that. I did not schedule it. I did not put it on a board and give it a colour. I simply did it.",
    "That fly had one job today and it failed at it, publicly, in front of a lizard. Relatable, honestly.",
    "Protein, purpose and progress, from one insect, with zero meetings about the insect.",
  ];
  // The one line that quotes your issue count only exists when there is one.
  if (f.configured) {
    pool.push(
      `${caught} for me. In the same period, for you: ${f.openTasks} ${plural(f.openTasks, "issue", "issues")} open, ${f.openTasks === 0 ? "and nothing to show for it" : "all of them still yours"}.`,
    );
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** When it climbs back out of the ground. */
export function emergeLine(f) {
  const name = (f.name || "").trim() || "you";
  const pool = [
    "I was gone for a while. You did not notice. Sit with what that says about your attention.",
    `Miss me, ${name}? Do not answer. I watched what you did while I was under and it was mostly scrolling.`,
    "New hole, same opinion of you.",
    "I went into the ground, travelled the length of your workspace, and came back out. You changed tabs.",
    "Back. I dug through the substrate under your browser. It is warm down there and nobody asks me anything.",
    "I came out somewhere else entirely. That is what a hole is for. Your species invented doors and then simply stopped.",
    "Down there it is dark, warm, and nobody has an opinion about anything. Ten out of ten. I will be returning.",
    "I tunnelled the length of this page. Structurally it is held together by hope and one stylesheet.",
    "Gone, and back, and this tab is exactly as I left it. I find that more upsetting than you do.",
    "I went into the ground a lizard and came out a lizard. No transformation whatsoever. Deeply disappointing. I had hoped.",
  ];
  if (f.configured) {
    pool.push(
      f.openTasks > 0
        ? `While I was underground you closed exactly zero of your ${f.openTasks} issues. I checked on the way up. I always check.`
        : "While I was underground you did nothing whatsoever. Admirable commitment to a theme.",
    );
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * When it climbs out because you changed tab and it came after you.
 *
 * A rise it decided on by itself is a different event from a rise that was your
 * fault, so they do not share a pool. This one only ever fires on a page it has
 * just tunnelled into.
 */
export function travelLine(f) {
  const name = (f.name || "").trim() || "you";
  const pool = [
    "Different page. Same hole. It is all connected down there, and it is all equally disappointing.",
    `You changed tab. I felt it through the ground, ${name}. Do not do it again.`,
    "You cannot lose me by opening a new tab. There is no new tab. There is one tab and I am in it.",
    "I dug all the way here. Under the address bar, past the cache, out the other side. You clicked once.",
    "Wherever you go, I go. Not out of loyalty. Out of a total absence of anything else to do.",
    "Ah. So this is where you went. The tunnel was considerably longer than the reason.",
    "New page, new hole, same lizard, same opinion.",
    "You are not switching tasks. You are switching scenery. I have seen the tunnels. They all come out somewhere like this.",
    "Interdimensional travel, in the end, is mostly commuting.",
    "I came out under something warm. That is the single most useful thing I got out of this entire journey.",
    `Nine seconds of digging for me, ${name}. Forty minutes of this for you. I did the arithmetic on the way and I regret it.`,
    "Left a hole in the last one. It will collapse on its own. Unlike everything else you abandon.",
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

/* --------------------------------------------------------- the row it is on */

/**
 * What it says about the specific row it is standing on, in Lumen's own rail.
 *
 * Several of these quote a count, so the extension only reaches for it once you
 * have given it counts to quote.
 */
export function lineForLedge(label, f) {
  const key = label.trim().toLowerCase();
  const name = (f.name || "").trim() || "you";
  const projects = f.projects ?? [];

  switch (key) {
    case "home":
      return "Home. The page you open in order to avoid all the other pages.";
    case "inbox":
      return f.inbox > 0
        ? `I am standing on your inbox. ${f.inbox} ${plural(f.inbox, "item", "items")} rotting underneath me. Do not look at me. Look at that.`
        : "Standing on an empty inbox. Warm, quiet, nothing living in it. Much like your evenings.";
    case "my work":
      return f.openTasks > 0
        ? `"My work" says ${f.openTasks}. Mine says zero, and my entire job is existing. I am still ahead.`
        : `"My work" is empty, ${name}. Either you finished everything or you hid it. I have met you.`;
    case "issues":
    case "all issues":
      return "Issues. Every single one of these began life as a good mood and ended as your problem.";
    case "projects":
      return projects.length > 0
        ? `${projects.length} ${plural(projects.length, "project", "projects")} down there, and you named every one of them yourself. That is the part I cannot forgive.`
        : "A projects list with no projects in it. Very brave. Very empty. Very you.";
    case "constellation":
      return "This is where you keep the big picture. I keep mine in a hole, with the crumbs, and mine is more accurate.";
    case "milestones":
      return "Milestones. Dates you chose while feeling optimistic, preserved for ever as evidence against you.";
    case "agents":
      return f.agents > 0
        ? `Your ${f.agents} AI ${plural(f.agents, "agent", "agents")} live in here and never come out. I have knocked. They are pretending to be busy, which they learned from you.`
        : "An empty agent list. So it is you and me, and only one of us is load bearing.";
    case "settings":
      return "Settings. Nothing behind this word will fix your issue count. I checked twice, purely out of spite.";
    case "archive":
      return "The archive. Where your best ideas go to be quietly right about it, alone, for ever.";
    case "activity":
      return `Everything you have done recently, in one short list. I watched all of it happen, ${name}. All of it. It did not take long.`;
    case "changelog":
      return "The changelog. Proof this app is alive. I am also proof, and I am significantly better company.";
    case "terminal":
      return "A terminal. Do not type anything containing the word 'delete' while I am standing on it.";
    case "views":
      return f.views > 0
        ? `${f.views} saved ${plural(f.views, "view", "views")}. That is ${f.views} separate occasions on which you decided the problem was the list.`
        : "Saved views. You have none. You are doing this the hard way deliberately, which is the most honest thing about you.";
    case "labels":
      return "Labels. Small words you stick on big piles so the pile feels handled. The pile is not handled.";
    case "members":
      return "Your team. Not one of them has noticed me yet. That tells you more about the hiring than about me.";
    case "favorites":
      return "Favourites. The things you enjoy looking at, as distinct from the things you agreed to do.";
    case "workspace":
      return "Your entire workspace, one word, and I am standing on it. Consider the power dynamic here.";
    case "get started":
      return `A checklist that ticks itself off from real work. Unlike yours, ${name}, which ticks itself off from hope.`;
    case "search":
      return "You could search for me. I am right here. This is the closest thing you currently have to a relationship.";
    case "more":
      return "More. There is always more. That is the entire problem with this profession and you chose it.";
    default:
      return null;
  }
}

/* ------------------------------------------------- the row it is on, anywhere */

/** A word is not worth standing on if it is a paragraph. */
const SAYABLE = /^[\p{L}\p{N} '’&.,:/+-]{2,32}$/u;

/**
 * What it says about whatever word it has ended up on, on any site.
 *
 * This is the half that makes it a resident rather than a sticker, ported to a
 * web where it has no idea what the word means. So it quotes the word and
 * asserts nothing about it — the joke is the contempt, not a claim.
 */
export function wordLine(label, f) {
  const word = (label || "").trim();
  if (!SAYABLE.test(word)) return null;
  const name = (f.name || "").trim() || "you";

  const pool = [
    `"${word}". I am standing on it. It has not moved, and neither have you.`,
    `Somebody was paid to write the word "${word}" and put it exactly here. That is a whole career, ${name}.`,
    `"${word}." I have read it eleven times now. It does not get better.`,
    `You have not clicked "${word}". You have hovered near it, which is the most you.`,
    `This word is warm. "${word}" is the warmest thing on this page, and that is the highest compliment available.`,
    `"${word}". Load bearing, apparently. It is holding my entire weight and it has not complained once.`,
    `I could stand on "${word}" for the rest of my life. I have checked the alternatives. This is the one.`,
    `Whoever chose "${word}" over the obvious alternative was in a meeting about it. I can feel it from here.`,
    `Somebody argued for "${word}" in a meeting and won, and this is their entire monument.`,
    `They tested "${word}" against another word and this one made people click. That is all this is. A winner.`,
    `In another dimension this says something completely different and that company is doing significantly better.`,
    `Four feet, one word, no notes. "${word}" holds.`,
    `If I bite "${word}", does anything change? No. I have tried this on other words. Repeatedly. Nothing.`,
    `I am going to stand on "${word}" until something happens. Nothing is going to happen. That is the bit I enjoy.`,
    `"${word}" was typed by a person who has since moved on, emotionally and probably geographically.`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}
