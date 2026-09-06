# Recurring todos & reminders

Some tasks come back on a schedule, such as paying rent, watering the plants, or a Monday standup. Instead of retyping them, set a todo to **repeat** and omanote keeps the cadence going.

## Setting up a recurring todo

The quickest way is to write it in plain language when you create the todo:

- `Water the plants every day`
- `Standup every mon and fri`
- `Pay rent every month on the last saturday until December`
- `Review goals every month on the first and third monday`
- `Take vitamins every day for 30 times`

As you type, a small chip appears confirming what omanote understood, for example *"repeats every month on the last Sat until Dec 31"*, so you can check it before saving. You can also set a repeat rule from the todo editor if you prefer buttons to typing.

Rules can be **open-ended**, or bounded by an **end date** ("until December") or a **number of repeats** ("10 times").

## How recurring todos show up

A recurring todo is stored once and shows up on **each day it's due**, rather than being copied into your list:

- On the **canvas**, an occurrence appears on every day the rule lands on. A daily todo shows every day; a "last Saturday" todo shows on each of those Saturdays.
- On the **Event calendar**, occurrences appear on their days alongside your logged events.
- In the **Todos list**, it appears as a single row for its current occurrence. A todo with no set time stays under **Today**. A timed one moves to **Overdue** once its time passes, then returns to Today on the next occurrence.

## Changing the schedule

Open a recurring todo and you'll find a **Repeat** field showing its rule in plain language, for example *every day, 5 times* or *every month on the last saturday*. Edit it there to change how often it repeats, change the number of repeats, or move the end date. Your changes carry forward to future occurrences, and the series keeps its original start date. Clear the field to turn repeating off.

## Completing and skipping

Check off an occurrence and omanote logs it for that day, then rolls the series forward to the next one. Completing yesterday's forgotten task counts for **today's** occurrence, and days you missed stay visible in your history.

Completing a recurring todo moves that day's occurrence to your completed list and mirrors it into your Events timeline, the same as any other todo. The series continues until it reaches its end date or repeat count.

## Repeating reminders

If your recurring todo has a time, its reminder **repeats too**. You get a reminder for each occurrence, and it keeps working even if you skip a day. Snooze is turned off for recurring todos, so deferring one occurrence can't shift the rest of the schedule.

## Quick reminders on a tight loop

For a reminder that repeats every few minutes over a short window, phrase it by the minute or hour:

- `Drink water every 30 minutes for the next 6 hours`
- `Stretch every hour`

omanote treats these as a **repeating reminder** on a single todo. It reminds you on that cadence until the window closes or you mark it done, without adding copies to your list.

## Deleting a recurring todo

When you delete a recurring todo, omanote asks what you actually mean:

- **Only this todo:** removes that one occurrence and leaves the rest of the series intact.
- **This and all future todos:** ends the series here, keeping everything before it.
- **All todos in the series:** removes the whole series.

The days you already completed stay in your history either way.
