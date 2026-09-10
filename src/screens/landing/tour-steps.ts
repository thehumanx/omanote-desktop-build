/**
 * The scroll-driven product tour's script.
 *
 * `anchor` matches a `data-tour-anchor` attribute inside CanvasPreview, or an
 * `artifact:<id>` for a single row in the day feed. `null` means the step
 * talks about the canvas as a whole — no tail, tooltip centred.
 *
 * Voice: first person, plain, no overclaiming. The point of the tour is that
 * someone can decide omanote isn't for them *before* signing up, so the copy
 * describes how it works rather than selling how good it is.
 *
 * Keep steps in scroll order: the tour derives its step index from scroll
 * position by array index.
 */
export type TourStep = {
  anchor: string | null;
  title: string;
  body: string;
  /**
   * Where the tooltip sits relative to the anchor. Default is below; use
   * `"above"` when the step is really about the content that follows the
   * anchor, which a tooltip below would sit on top of, and `"beside"` for
   * anchors pinned to the top of the frame, where neither above nor below
   * leaves the canvas visible.
   */
  place?: "above" | "below" | "beside";
};

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: null,
    title: "Today is your canvas",
    body: "Everything you capture lands on it, in the order it happened. Tomorrow starts a clean one. Plus more, everything that needs your attention today shows up here as well. ",
  },
  {
    anchor: "week-glance",
    title: "How the week's going",
    body: "What you captured, and how many days running you've turned up. It isn't a score and nothing nags you about it — I just like knowing the habit is still alive.",
  },
  {
    anchor: "updates",
    title: "What changed",
    body: "Release notes, and occasionally a product notifications. Inline on the canvas, where you can ignore it, but silently stays there until you take action.",
  },
  {
    anchor: "continue-writing",
    title: "When something needs more room",
    body: "Some things don't fit on a line, its more than just a thought. Make a page — a real document, with headings, checklists and images and yes, todos that gets tracked.",
  },
  {
    anchor: "overdue",
    title: "What slipped",
    body: "Todos that came and went while you were busy. Tick them off, pull them into today, or push them to next week.",
  },
  {
    anchor: "today-heading",
    // The anchor is just the section label; the stream it's describing runs
    // below it, so the tooltip sits above and leaves that visible.
    place: "above",
    title: "Four kinds of thoughts, one stream",
    body: "Notes, todos, bookmarks, events — artifacts, collectively you add shows up here. Completed todos becomes an event on your day.",
  },
  {
    anchor: "composer",
    title: "Press / from anywhere",
    body: "Or click +. The composer opens already set to whatever you're looking at or typed. Use / commands for todos and events. You can create a new page from here as well.",
  },
  {
    // Points at one row of the #iceland thread rather than the whole day feed,
    // which is taller than the screen and so can't be pointed at.
    anchor: "artifact:note-iceland",
    title: "Hashtags, if you want them",
    body: "A note, a todo and an event here all carry #iceland, so Explore can pull them into one thread. Use hashtags to group related thoughts, or just to make them easier to find later.",
  },
  {
    anchor: "date",
    // The date control is pinned to the top of the frame: there's nothing
    // above it to point down at, and sitting below it covers the day the step
    // is inviting you to step back from.
    place: "beside",
    title: "Every day before this one",
    body: "The canvas isn't only today. Step back through any past day and it's exactly as you left it, its an archive of your thoughts.",
  },
  {
    // Renders the real offline banner for the duration of this step, since a
    // visitor on a working connection would never otherwise see it.
    anchor: "offline",
    title: "Works with no signal",
    body: "Everything saves on your device first and syncs when you're back. You still need internet to login or sign up.",
  },
];
