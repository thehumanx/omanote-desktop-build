# Recurring todos & reminders

Some tasks come back on a schedule, such as paying rent, watering the plants, or a Monday standup. Instead of retyping them, set a todo to **repeat** and omanote keeps the cadence going.

## Setting up a recurring todo

The quickest way is to write it in plain language when you create the todo:

- `Water the plants every day`
- `Standup every mon and fri`
- `Pay rent every month on the last saturday until December`
- `Pay the electricity bill every month on the 5th` (or `on the 5th of every month`, or `every 5th`)
- `Team sync every 2 weeks on friday`
- `Mum's birthday every year on march 3`
- `Gym every day starting monday`
- `Review goals every month on the first and third monday`
- `Take vitamins every day for 30 times`

As you type, a small chip appears confirming what omanote understood, for example *"repeats every month on the last Sat until Dec 31"*, so you can check it before saving. You can also set a repeat rule from the todo editor if you prefer buttons to typing.

Rules can be **open-ended**, or bounded by an **end date** ("until December") or a **number of repeats** ("10 times").

A monthly or yearly todo repeats on the day you name. Without one, it repeats on the day you create it, so "every month" typed on the 25th means every 25th. A series starts today unless you say otherwise ("starting monday", "from october").

## How recurring todos show up

A recurring todo is stored once and shows up on **each day it's due**, rather than being copied into your list:

- On the **canvas**, an occurrence appears on every day the rule lands on. A daily todo shows every day; a "last Saturday" todo shows on each of those Saturdays.
- If the series **starts later**, it also shows on the day you created it, labelled with its first date and rule, for example *Starts Wed, Sep 30 · every day*. It doesn't appear on the days in between.
- If you **miss** an occurrence, it waits in the **Overdues** section of today's canvas until the next one is due. A weekly Monday todo you missed stays there Tuesday to Sunday; the next Monday, the new one appears in today's list instead. A missed daily never lands in Overdues, since the next one is always today. Older misses stay faded on their own days.
- On the **Event calendar**, occurrences appear on their days alongside your logged events.
- In the **Todos list**, it appears as a single row for its current occurrence. A todo with no set time stays under **Today**. A timed one moves to **Overdue** once its time passes, then returns to Today on the next occurrence.

## Changing the schedule

Open a recurring todo and you'll find a **Repeat** field showing its rule in plain language, for example *every day, 5 times* or *every month on the last saturday*. Edit it there to change how often it repeats, the day it lands on, the number of repeats, or the end date. Your changes carry forward to future occurrences. The series keeps its original start unless you name a new day or start date, and days you deleted from it stay deleted. Clear the field to turn repeating off.

## Completing and skipping

Check off an occurrence and omanote rolls the series forward to the next one. The occurrence stays on its own day, marked done with the date you finished it, and the completion is logged as an event on the day you ticked it. So finishing Monday's task on Wednesday shows it done on Monday and logged on Wednesday, the same as any other todo. Days you missed and never completed stay visible in your history.

The series continues until it reaches its end date or repeat count.

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
