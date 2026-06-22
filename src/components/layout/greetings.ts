type GreetingBucket = "early" | "morning" | "afternoon" | "evening" | "night";

const GREETINGS: Record<GreetingBucket, string[]> = {
  early: [
    "🌄 Rise and shine",
    "🌅 Up with the sun",
    "🐦 Early bird",
    "☕ Coffee and conquer",
    "✨ Dawn patrol",
    "🧃 Fresh start, fresh chaos",
    "🚀 Early launch mode",
    "🌞 Hello, sunshine",
    "🥱 Look at you, up early",
    "🛌 Before the world wakes up",
    "🌤️ Tiny victory already",
    "🧠 First plot twist of the day",
    "🐓 Suspiciously early",
    "🌙 Still dark outside, respect",
    "🧊 Cold start, warm vibes",
    "🦅 Before the chaos begins",
    "🫖 Tea time but make it 5am",
    "👁️ Eyes open, brain optional",
    "🌫️ Foggy but functional",
    "🎧 Quiet hours, just you",
    "🕔 Nobody else is awake yet",
    "🥷 Stealth mode: morning",
  ],
  morning: [
    "☀️ Good morning",
    "🌤️ Morning, superstar",
    "🥐 Breakfast first, genius",
    "📣 Morning, legend",
    "🌈 Another glorious day",
    "☕ Hello, caffeinated one",
    "🎯 Let's make it count",
    "🧠 Brain loading...",
    "🌻 Good to see you",
    "😄 Morning, troublemaker",
    "🛸 Morning from planet productivity",
    "🫶 Hello there, daily champion",
    "🍳 Eggs optional, chaos mandatory",
    "🐣 Freshly hatched and ready",
    "📬 Inbox zero? Inbox hero",
    "🌞 The morning has opinions",
    "🧇 Waffle energy activated",
    "🫧 Still buffering",
    "🎺 Ta-da, you showed up",
    "🐝 Busy already, love that",
    "🥳 Another day, another slay",
    "💌 Morning dispatch, just for you",
  ],
  afternoon: [
    "⛅ Good afternoon",
    "🌻 Afternoon, champion",
    "🍜 Fuel up and keep going",
    "🧃 Midday momentum",
    "🪄 Still in the game",
    "🚦 Halfway and hanging in",
    "🌈 Big afternoon energy",
    "🧠 Steady and weirdly productive",
    "🍕 Snack break optional",
    "📈 The plot thickens",
    "🌞 Noon-ish nobility",
    "🫡 You're doing great, honestly",
    "🐪 Hump day, hump hour",
    "🕑 2pm and thriving, barely",
    "🫠 Post-lunch fog? Same",
    "🍦 Treat yourself",
    "🎲 Roll the dice on productivity",
    "🧃 Second wind incoming",
    "🌤️ Getting there, slowly",
    "🏄 Riding the afternoon wave",
    "🔁 Loop it back, stay on track",
    "🐢 Slow and steady wins the 'noon",
  ],
  evening: [
    "🌆 Good evening",
    "🌇 Evening, legend",
    "🍜 You've earned the pause",
    "🛋️ Cozy mode activated",
    "🎬 End-of-day credits rolling",
    "🌙 Soft landing time",
    "🫶 Look at you, still going",
    "✨ Evening excellence",
    "🍷 Virtually unwinding",
    "🛋️ One more tiny thing?",
    "🧩 Tiny last mission, maybe?",
    "🌅 Golden hour, golden work",
    "🕯️ Candlelight productivity",
    "🎶 Evening playlist loading",
    "🧸 Settling in nicely",
    "🌮 Dinner first, then genius",
    "🌠 Stars are clocking in",
    "🫁 Deep breath, you made it",
    "📖 Wind-down with purpose",
    "🥂 To surviving another one",
    "🧣 Wrapping up, wrapping warm",
    "🌃 Moonlit momentum",
  ],
  night: [
    "🌙 Still at it",
    "🕯️ Burning midnight oil",
    "🦉 Night owl",
    "💫 Late but great",
    "🧃 The after-hours crew",
    "🌌 Quiet productivity hours",
    "🛌 Should this be bedtime?",
    "📚 One last brain cell",
    "🐾 Secret night mission",
    "🫥 The goblin shift continues",
    "🛋️ Cozy chaos hours",
    "🌑 Operating in the dark",
    "🧛 Creatures of the night, unite",
    "🔦 Flashlight focus mode",
    "🌊 Deep night, deep thoughts",
    "🪐 In orbit while others sleep",
    "😴 Almost bedtime, almost",
    "🌒 Crescent energy only",
    "🐭 If you give a mouse a deadline",
    "🎃 Haunted by your to-do list",
    "🌜 The moon sees your hustle",
    "🌃 Moonlit momentum",
  ],
};

function getGreetingBucket(date: Date): GreetingBucket {
  const hour = date.getHours();
  if (hour >= 4 && hour < 7) return "early";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function hashGreetingSeed(date: Date, bucket: GreetingBucket) {
  return (
    date.getFullYear() * 372 +
    date.getMonth() * 31 +
    date.getDate() +
    bucket.charCodeAt(0)
  );
}

function getLeadingEmoji(phrase: string) {
  return phrase.split(/\s+/)[0] ?? "👋";
}

export function getGreetingForDate(date: Date, name: string): { full: string; short: string } {
  const bucket = getGreetingBucket(date);
  const options = GREETINGS[bucket];
  const phrase = options[hashGreetingSeed(date, bucket) % options.length] ?? options[0]!;
  const emoji = getLeadingEmoji(phrase);

  return {
    full: `${phrase}, ${name}`,
    short: `${emoji} ${name}`,
  };
}