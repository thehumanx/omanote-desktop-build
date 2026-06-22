const IRREGULAR: Record<string, string> = {
  arise: "arose",
  awake: "awoke",
  be: "was",
  bear: "bore",
  beat: "beat",
  become: "became",
  begin: "began",
  bend: "bent",
  bind: "bound",
  bite: "bit",
  bleed: "bled",
  blow: "blew",
  break: "broke",
  breed: "bred",
  bring: "brought",
  broadcast: "broadcast",
  build: "built",
  burn: "burned",
  buy: "bought",
  catch: "caught",
  choose: "chose",
  come: "came",
  cost: "cost",
  cut: "cut",
  deal: "dealt",
  dig: "dug",
  do: "did",
  draw: "drew",
  drink: "drank",
  drive: "drove",
  eat: "ate",
  fall: "fell",
  feed: "fed",
  feel: "felt",
  fight: "fought",
  find: "found",
  flee: "fled",
  fly: "flew",
  forget: "forgot",
  forgive: "forgave",
  freeze: "froze",
  get: "got",
  give: "gave",
  go: "went",
  grow: "grew",
  hang: "hung",
  have: "had",
  hear: "heard",
  hide: "hid",
  hit: "hit",
  hold: "held",
  hurt: "hurt",
  keep: "kept",
  know: "knew",
  lay: "laid",
  lead: "led",
  leave: "left",
  lend: "lent",
  let: "let",
  lose: "lost",
  make: "made",
  mean: "meant",
  meet: "met",
  pay: "paid",
  put: "put",
  quit: "quit",
  read: "read",
  ride: "rode",
  ring: "rang",
  rise: "rose",
  run: "ran",
  say: "said",
  see: "saw",
  sell: "sold",
  send: "sent",
  set: "set",
  shake: "shook",
  shoot: "shot",
  show: "showed",
  shrink: "shrank",
  shut: "shut",
  sing: "sang",
  sink: "sank",
  sit: "sat",
  sleep: "slept",
  slide: "slid",
  speak: "spoke",
  spend: "spent",
  split: "split",
  spread: "spread",
  stand: "stood",
  steal: "stole",
  stick: "stuck",
  strike: "struck",
  sweep: "swept",
  swim: "swam",
  swing: "swung",
  take: "took",
  teach: "taught",
  tear: "tore",
  tell: "told",
  think: "thought",
  throw: "threw",
  understand: "understood",
  wake: "woke",
  wear: "wore",
  win: "won",
  withdraw: "withdrew",
  write: "wrote",
};

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// Common regular imperative verbs used as todo title openers.
// Only these (plus the IRREGULAR list above) are conjugated — everything
// else is returned unchanged so nouns like "gym" or "apple" are never touched.
const COMMON_IMPERATIVE_VERBS = new Set([
  "add", "apply", "arrange", "ask", "attend", "avoid",
  "book", "browse", "build", "buy",
  "call", "cancel", "change", "check", "clean", "clear", "close",
  "collect", "complete", "connect", "contact", "continue", "cook", "copy", "create",
  "delete", "design", "discuss", "download", "draft",
  "edit", "email", "enable", "exercise",
  "fill", "finish", "fix", "follow",
  "implement", "install",
  "join",
  "learn", "listen",
  "meet", "message", "move",
  "open", "order", "organize",
  "pay", "pick", "plan", "post", "practice", "prepare", "print", "purchase",
  "record", "register", "remove", "rename", "repair", "reply",
  "research", "respond", "review",
  "save", "schedule", "send", "share", "sign", "start", "stop", "study", "submit",
  "talk", "test", "transfer",
  "update", "upload",
  "verify", "visit",
  "walk", "watch", "work", "write",
]);

function isLikelyImperativeVerb(word: string): boolean {
  return COMMON_IMPERATIVE_VERBS.has(word.toLowerCase());
}

function regularPastTense(verb: string): string {
  const w = verb.toLowerCase();

  if (w.endsWith("e")) return `${verb}d`;

  if (w.endsWith("y") && w.length > 1 && !VOWELS.has(w[w.length - 2])) {
    return `${verb.slice(0, -1)}ied`;
  }

  const len = w.length;
  if (len >= 3) {
    const c1 = w[len - 3];
    const c2 = w[len - 2];
    const c3 = w[len - 1];
    // consonant-vowel-consonant → double the last consonant
    if (!VOWELS.has(c1) && VOWELS.has(c2) && !VOWELS.has(c3) && c3 !== "w" && c3 !== "x" && c3 !== "y") {
      return `${verb}${c3}ed`;
    }
  }

  return `${verb}ed`;
}

function preserveCase(original: string, result: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

export function conjugateTitleToPastTense(title: string): string {
  if (!title) return title;

  // Split keeping whitespace tokens so we can rejoin exactly
  const tokens = title.split(/(\s+)/);
  const firstWord = tokens[0];
  if (!firstWord) return title;

  const lower = firstWord.toLowerCase();
  const irregular = IRREGULAR[lower];

  let pastForm: string;
  if (irregular !== undefined) {
    pastForm = preserveCase(firstWord, irregular);
  } else if (isLikelyImperativeVerb(lower)) {
    pastForm = preserveCase(firstWord, regularPastTense(lower));
  } else {
    return title;
  }

  tokens[0] = pastForm;
  return tokens.join("");
}
