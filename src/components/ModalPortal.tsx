import { type ReactNode } from "react";
import { createPortal } from "react-dom";

// Mounts synchronously on the client's first render (rather than deferring
// to an effect) so refs inside `children` are attached to the DOM by the
// time sibling effects run in the same commit — a deferred mount left those
// refs null on their first (and often only, e.g. empty-deps) effect pass.
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;

  return createPortal(children, document.body);
}
