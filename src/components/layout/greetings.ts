type GreetingBucket = "early" | "morning" | "afternoon" | "evening" | "night";

const GREETINGS: Record<GreetingBucket, string[]> = {
  early: [
    "🌄 Rise and shine",
    "🌅 Up with the sun",
    "🐦 Good morning, early bird",
    "☕ Off to an early start",
    "✨ Good morning",
    "🚀 Early start today",
    "🌞 Hello, sunshine",
    "🥱 Look at you, up early",
    "🌤️ Good morning",
    "🧠 Fresh start",
    "👁️ Quiet morning hours",
    "🎧 Just you and the quiet",
    "🕔 Nobody else is awake yet",
  ],
  morning: [
    "☀️ Good morning",
    "🌤️ Morning",
    "🥐 Good morning",
    "☕ Good morning, time for coffee",
    "🎯 Ready to get started",
    "🧠 Let's get going",
    "🌻 Good to see you",
    "😄 Good morning",
    "🫶 Good morning, glad you're here",
    "🌞 Good morning",
    "🥳 Here's to a good day",
  ],
  afternoon: [
    "⛅ Good afternoon",
    "🌻 Good afternoon",
    "🍜 Keep going, you've got this",
    "🧃 Afternoon boost",
    "📈 Making progress",
    "🫡 You're doing great",
    "🕑 Good afternoon",
    "🍦 Take a short break if you need it",
    "🌤️ Getting there",
    "🐢 Slow and steady, that's fine",
  ],
  evening: [
    "🌆 Good evening",
    "🌇 Good evening",
    "🍜 You've earned a break",
    "🛋️ Time to wind down",
    "🌙 Good evening",
    "🫶 Look at you, still going",
    "✨ Nice work today",
    "🥂 You made it through the day",
    "🌅 Good evening",
    "🫁 Deep breath, you made it",
    "📖 Time to wind down",
  ],
  night: [
    "🌙 Still up",
    "🕯️ Burning the midnight oil",
    "🦉 Night owl",
    "💫 Working late",
    "🌌 Quiet hours",
    "🛌 Might be time for bed",
    "😴 Almost bedtime",
    "🌊 Late night",
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

export function getGreetingForDate(
  date: Date,
  name: string,
): { full: string; short: string; emoji: string; text: string } {
  const bucket = getGreetingBucket(date);
  const options = GREETINGS[bucket];
  const phrase = options[hashGreetingSeed(date, bucket) % options.length] ?? options[0]!;
  const emoji = getLeadingEmoji(phrase);
  const phraseWithoutEmoji = phrase.slice(emoji.length).trim();

  return {
    full: `${phrase}, ${name}`,
    short: `${emoji} ${name}`,
    emoji,
    text: `${phraseWithoutEmoji}, ${name}`,
  };
}