# How your data is protected

omanote is built so that **only you can read your content**. This page explains what that means.

## Encrypted on your device

When you write a note, todo, bookmark, event, or canvas page, omanote encrypts the text **on your device** before it's sent to the cloud. The servers store only ciphertext, so the people who run omanote can't read your words, and neither can anyone who gains access to the database.

Your content is unlocked with a **passphrase** that only you know. It becomes the key that locks and unlocks your data, and that key never leaves your device in readable form.

## Your recovery key

Because your passphrase is the only thing that can unlock your data, omanote gives you a **recovery key** when you set up encryption. It's a backup way in if you forget your passphrase.

**Save your recovery key somewhere safe.** If you forget your passphrase *and* lose your recovery key, your encrypted content cannot be recovered by anyone, including us.

## What's protected, and what isn't

- **Protected:** the content itself, including note text, todo titles, bookmark details, event descriptions, canvas pages, images you add to a page, and folder names.
- **Not hidden:** structural metadata such as timestamps, how many items you have, and which day something belongs to. This lets the app stay fast without exposing what you wrote.
- **Deliberately public:** anything you turn a public link on for. To be readable by someone without your passphrase, a shared folder or page is copied to our servers unencrypted while the link is on. Turning the link off deletes the copy.

## Across your devices

The same encryption works on the web app, mobile apps, and browser extension. Everything is locked with your key, so your data stays private as it syncs between them.
