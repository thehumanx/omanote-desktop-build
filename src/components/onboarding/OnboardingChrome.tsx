import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { SceneBackdrop } from "../scene/SceneBackdrop";
import { useSceneAttributes } from "../scene/useSceneAttributes";
import { useSceneSettings } from "../scene/useSceneSettings";
import { cn } from "../ui";

const FooterNodeContext = createContext<HTMLDivElement | null>(null);

/**
 * True inside a step that is animating out (OnboardingWizard keeps the old
 * step mounted while the new one comes in). Its footer stays out of the slot,
 * so there's never a second Back/Continue there.
 */
export const OnboardingStepExitingContext = createContext(false);

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
  // The scene picked on the first step paints straight away, so it can be
  // judged live; until one is picked the wizard keeps its dot grid.
  const { scene, drift, grain } = useSceneSettings();
  const activeScene = scene === "none" ? null : scene;
  useSceneAttributes(activeScene, drift, grain);

  return (
    <div className={cn("relative flex min-h-screen flex-col", activeScene ? "bg-app-backdrop" : "omanote-canvas-grid bg-app-canvas")}>
      {activeScene ? <SceneBackdrop scene={activeScene} /> : null}
      <div className="relative flex justify-center px-4 pt-10 pb-2">
        <img src="/logo.svg" alt="omanote" className="omanote-stagger-in h-7 w-auto" />
      </div>
      {/* Top-anchored, not centred: every step's header lands on the same
          line whatever the step's height, so moving between steps doesn't
          make the title jump (see OnboardingStepHeader). */}
      <div className="relative flex flex-1 justify-center px-4 pb-4 pt-[max(2rem,10vh)]">
        <div className="w-full max-w-xl">
          <FooterNodeContext.Provider value={footerNode}>{children}</FooterNodeContext.Provider>
        </div>
      </div>
      <div className="relative flex justify-center px-4 pb-10">
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
  const exiting = useContext(OnboardingStepExitingContext);
  if (exiting) return null;
  const content = <div className="flex items-center justify-between gap-2">{children}</div>;
  return node ? createPortal(content, node) : content;
}

/**
 * Style for one element of a stacked entrance (pair with the
 * `omanote-stagger-in` class): the index is its place in the stack and sets
 * its delay.
 */
export function staggerStyle(index: number): React.CSSProperties {
  return { ["--stagger-index" as string]: index };
}

/**
 * Every step's title block: title, subtitle, and anything that belongs with
 * them (a carousel's dots). The shell puts it at the same spot on every step,
 * and on a step change it cross-fades in place while the body below slides
 * (`omanote-wizard-header` / `omanote-wizard-body` in index.css).
 */
export function OnboardingStepHeader({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="omanote-wizard-header flex flex-col items-center text-center">
      <h1 className="text-2xl font-black text-app-ink">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-app-ink-muted">{subtitle}</p>
      {children}
    </div>
  );
}
