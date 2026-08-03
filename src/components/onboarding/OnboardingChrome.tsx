import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../ui";

const FooterNodeContext = createContext<HTMLDivElement | null>(null);

/**
 * Full-page shell shared by every onboarding step: the omanote logo pinned
 * at the top and a footer slot pinned at the bottom, both in a fixed
 * position regardless of how tall the current step's content is — only the
 * center content area grows/shrinks. Steps portal their nav buttons into the
 * footer slot via `OnboardingFooter` instead of rendering them inline, which
 * is what keeps Back/Continue from jumping around between steps.
 */
export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [footerNode, setFooterNode] = useState<HTMLDivElement | null>(null);

  return (
    <div className={cn("omanote-canvas-grid flex min-h-screen flex-col bg-app-canvas")}>
      <div className="flex justify-center px-4 pt-10 pb-2">
        <img src="/logo.svg" alt="omanote" className="h-7 w-auto" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-4">
        <div className="w-full max-w-xl">
          <FooterNodeContext.Provider value={footerNode}>{children}</FooterNodeContext.Provider>
        </div>
      </div>
      <div className="flex justify-center px-4 pb-10">
        <div ref={setFooterNode} className="w-full max-w-xl" />
      </div>
    </div>
  );
}

/**
 * Portals its children into the shell's footer slot (see `OnboardingShell`).
 * Falls back to rendering inline when there's no `OnboardingShell` ancestor
 * (e.g. a step rendered standalone in a unit test) so steps don't depend on
 * the wizard chrome just to have working buttons.
 */
export function OnboardingFooter({ children }: { children: React.ReactNode }) {
  const node = useContext(FooterNodeContext);
  const content = <div className="flex items-center justify-between gap-2">{children}</div>;
  return node ? createPortal(content, node) : content;
}
