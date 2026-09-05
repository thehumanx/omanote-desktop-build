# How your data is protected

omanote is built so that **only you can read your content**. This page explains what that means in plain language.

## Encrypted on your device

When you write a note, todo, bookmark, event, or canvas, omanote encrypts the text **on your device** before it's ever sent to the cloud. The servers store only scrambled text — the people who run omanote can't read your words, and neither can anyone who might gain access to the database.

Your content is unlocked with a **passphrase** that only you know. It's turned into the key that locks and unlocks your data, and that key never leaves your device in a readable form.

## Your recovery key

Because your passphrase is the only thing that can unlock your data, omanote gives you a **recovery key** when you set up encryption — a backup way in if you ever forget your passphrase.

**Save your recovery key somewhere safe.** If you forget your passphrase *and* lose your recovery key, your encrypted content cannot be recovered by anyone, including us. That's the trade-off that makes the privacy real.

## What's protected — and what isn't

- **Protected:** the actual content — your note text, todo titles, bookmark details, event descriptions, canvas documents, images you add to a canvas, folder names.
- **Not hidden:** structural metadata like timestamps, how many items you have, and which day something belongs to. This lets the app stay fast and functional without exposing what you wrote.
- **Deliberately public:** anything you turn a public link on for. To be readable by someone who doesn't have your passphrase, a shared folder or canvas is copied to our servers unencrypted while the link is on — that's the trade you're making when you share. Turning the link off deletes the copy.

## Across your devices

The same encryption works on the web app, mobile apps, and browser extension. Because everything is locked with your key, your data stays private as it syncs between them.
