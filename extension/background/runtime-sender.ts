export function isTrustedRuntimeSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === undefined || sender.id === chrome.runtime.id;
}
