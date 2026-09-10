// Kept in sync by hand with the FAQPage JSON-LD in index.html — that's
// static markup outside the React build, so it can't import this array
// directly. If you change a question or answer here, change it there too —
// src/seo/static-seo.test.ts fails if the two drift.
//
// This array is also where landing-page keyword prose lives now that the
// standalone feature sections are gone: the product tour explains the app, and
// anything a search engine needs to read is answered here and mirrored into the
// FAQPage structured data.
export const FAQ_ITEMS = [
  {
    question: "What is omanote?",
    answer:
      "omanote (stylized in smallcase) is a canvas for your thoughts: one page for each day, where notes, todos, bookmarks and events land in the order you captured them.",
  },
  {
    question: "Is omanote an AI note-taking app?",
    answer:
      "No. omanote has no AI features. Nothing is AI-written, AI-summarized, or sent to a model. It is built around manual capture, folders, and hashtags.",
  },
  {
    question: "What is the canvas?",
    answer:
      "The canvas shows one day at a time. Anything you capture lands there first, and also appears in Notes, Todos, Bookmarks, or Events. For longer writing, create a canvas page: a full document similar to a Notion page or Google Doc, with its own title, checklists, links, and images. Create as many as you want.",
  },
  {
    question: "Can I add images to omanote?",
    answer:
      "Yes, inside canvas pages. Drop an image in, resize it, and add a caption. Images are encrypted on your device before upload. Storage is capped at 200MB per account while accounts are free.",
  },
  {
    question: "Do I need slash commands?",
    answer:
      "No, but pressing / is the fastest way in. It opens the composer from anywhere in the app, already set to match the tab you are on. From there you can type a plain note, paste a link, or use /todo or /bookmark to pick a type directly. Inside a canvas page, / opens a block menu for headings, checklists, lists, images, quotes, and code blocks.",
  },
  {
    question: "How are notes, todos, bookmarks, and events connected?",
    answer:
      "Each one is a focused view of the same day. You capture on the canvas, then use the specific view to organize and manage that item later. Add the same hashtag across types and Explore shows them together, so you can also connect them by topic instead of by date.",
  },
  {
    question: "Can I read RSS feeds in omanote?",
    answer:
      "Yes. omanote has two modes on the same canvas. Write mode is where you capture notes, todos, bookmarks and events. Read mode is a built-in RSS reader: subscribe to feeds, sort them into categories, read articles inline, and save the ones worth keeping as bookmarks. The reader sits in the same app, so there is no context switch.",
  },
  {
    question: "Can scheduled todos show up in the calendar?",
    answer:
      "Yes. Date-only todos stack at the top of the day, timed todos land in the right slot, and completed ones keep their scheduled context.",
  },
  {
    question: "Can todos repeat, or remind me about something?",
    answer:
      "Yes to both, in plain English. Type \"every mon and fri\" or \"pay rent every month until December\" and omanote sets the recurring schedule as you type — repeating daily, weekly, monthly, or on chosen weekdays, and ending on a date or after a fixed number of times. Write \"drink water every 30 minutes for 6 hours\" and it parses the date, time, and interval into a reminder. You never have to fill in a date picker to capture a todo.",
  },
  {
    question: "Does omanote sync with Google Calendar?",
    answer:
      "Yes, both ways and automatically. Scheduled todos appear in Google Calendar, and Google Calendar events appear on your day in omanote. Mention @someone's email in a todo to invite them.",
  },
  {
    question: "How does Explore work?",
    answer:
      "Add the same hashtag to a note, a todo, and an event, and Explore shows them together as a map. It is a way to browse by topic instead of by date.",
  },
  {
    question: "Does omanote track my habits or stats?",
    answer:
      "Lightly. Insights shows a completion rate, an overdue rate, and a 365-day activity heatmap of what you captured. The canvas also shows how the past week went and how many days running you have turned up. It is not a score and nothing nags you about it.",
  },
  {
    question: "Can I share my bookmarks, notes, or todos with someone?",
    answer:
      "Yes. Bookmark folders, note folders, todo folders, and canvas pages can each be turned into a public link from their settings. Visitors get a read-only page. One caveat: a public page has to be readable without your passphrase, so that folder or page is stored unencrypted while the link is on. Switch it off and that copy is deleted. Anything you have not shared stays encrypted.",
  },
  {
    question: "Does omanote work offline?",
    answer:
      "Yes. Changes save locally and sync when your connection comes back, so you can keep capturing without a connection.",
  },
  {
    question: "Is my data private?",
    answer:
      "User content is encrypted on your device before it is stored. You unlock it with your passphrase, so the app is designed around private personal use.",
  },
  {
    question: "What if I forget my passphrase?",
    answer:
      "During setup, omanote gives you a recovery key to download. Store it somewhere safe. If you forget your passphrase, that key is the only way back into your account.",
  },
  {
    question: "Can I move my data to another account?",
    answer:
      "Yes. Settings has export and import tools. Exported data is decrypted plain text, so keep the file somewhere safe.",
  },
];
