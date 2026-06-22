import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  CheckboxField,
  Chip,
  DateStripHighlight,
  DialogSurface,
  DrawerSurface,
  Input,
  MenuItem,
  OptionCard,
  Panel,
  SegmentedHighlight,
  SegmentedItem,
  SegmentedItemLabel,
  SegmentedPill,
  SegmentedShell,
  Select,
  Switch,
  TextArea,
  TodoCheckmark,
  segmentedItemClass,
} from "./ui";

describe("ui primitives", () => {
  it("renders semantic button variants", () => {
    render(
      <>
        <Button>Primary</Button>
        <Button tone="plain">Cancel</Button>
        <Button tone="danger">Destroy</Button>
        <Button tone="dangerGhost">Naked destroy</Button>
        <Button tone="danger" disabled>
          Disabled destroy
        </Button>
        <Button tone="soft">Save</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("omanote-button-chrome");
    expect(screen.getByRole("button", { name: "Primary" })).toHaveClass("text-action-primary-ink");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("omanote-button-plain");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("bg-transparent");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("text-app-ink");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("hover:bg-app-surface-hover");
    expect(screen.getByRole("button", { name: "Destroy" })).toHaveClass("omanote-button-destructive");
    expect(screen.getByRole("button", { name: "Destroy" })).toHaveClass("text-danger-solid-ink");
    expect(screen.getByRole("button", { name: "Destroy" })).not.toHaveClass("omanote-button-chrome");
    expect(screen.getByRole("button", { name: "Naked destroy" })).toHaveClass("text-danger-ink");
    expect(screen.getByRole("button", { name: "Naked destroy" })).toHaveClass("omanote-button-danger-ghost");
    expect(screen.getByRole("button", { name: "Naked destroy" })).toHaveClass("hover:bg-danger-surface");
    expect(screen.getByRole("button", { name: "Naked destroy" })).toHaveClass("bg-transparent");
    expect(screen.getByRole("button", { name: "Naked destroy" })).not.toHaveClass("omanote-button-destructive");
    expect(screen.getByRole("button", { name: "Disabled destroy" })).toHaveClass("disabled:opacity-40");
    expect(screen.getByRole("button", { name: "Disabled destroy" })).not.toHaveClass("disabled:opacity-100");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-app-surface-muted");
  });

  it("renders form controls with semantic classes", () => {
    render(
      <>
        <Input aria-label="Title" />
        <TextArea aria-label="Body" />
        <Select aria-label="Mode" />
      </>,
    );
    expect(screen.getByLabelText("Title")).toHaveClass("bg-app-surface");
    expect(screen.getByLabelText("Body")).toHaveClass("bg-app-surface");
    expect(screen.getByLabelText("Mode")).toHaveClass("bg-app-surface");
  });

  it("renders switch checked and unchecked states", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "false");
    rerender(<Switch checked onCheckedChange={() => {}} aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders checkbox fields with chrome checkmarks", () => {
    const { rerender } = render(
      <CheckboxField checked={false} onCheckedChange={() => {}}>
        Enable reminders
      </CheckboxField>,
    );

    const unchecked = screen.getByRole("checkbox", { name: "Enable reminders" });
    expect(unchecked).toHaveAttribute("aria-checked", "false");
    expect(unchecked).toHaveClass("gap-3");
    expect(unchecked.querySelector(".omanote-todo-checkmark-open")).toBeInTheDocument();
    expect(unchecked.querySelector(".omanote-todo-checkmark")?.tagName).toBe("SPAN");

    rerender(
      <CheckboxField checked onCheckedChange={() => {}}>
        Enable reminders
      </CheckboxField>,
    );

    const checked = screen.getByRole("checkbox", { name: "Enable reminders" });
    expect(checked).toHaveAttribute("aria-checked", "true");
    expect(checked.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
  });

  it("renders circular chrome todo checkmarks", () => {
    const { rerender } = render(<TodoCheckmark aria-label="toggle todo" checked={false} />);

    const openCheckmark = screen.getByRole("button", { name: "toggle todo" });
    expect(openCheckmark).toHaveClass("omanote-todo-checkmark");
    expect(openCheckmark).toHaveClass("omanote-todo-checkmark-open");
    expect(openCheckmark).toHaveClass("overflow-visible");
    expect(openCheckmark).toHaveClass("rounded-app-chip");
    expect(openCheckmark.querySelector(".omanote-todo-checkmark-chrome")).toBeInTheDocument();
    expect(openCheckmark.querySelector(".omanote-todo-checkmark-chrome")).toHaveClass("omanote-todo-checkmark-chrome-md");

    rerender(<TodoCheckmark aria-label="toggle todo" checked />);

    const doneCheckmark = screen.getByRole("button", { name: "toggle todo" });
    expect(doneCheckmark).toHaveAttribute("aria-pressed", "true");
    expect(doneCheckmark).toHaveClass("omanote-todo-checkmark-done");
    expect(doneCheckmark).toHaveClass("omanote-todo-checkmark-bleed-md");
    expect(doneCheckmark).not.toHaveClass("omanote-todo-checkmark-bleed");
  });

  it("keeps todo checkmark focus rings keyboard-only", () => {
    render(<TodoCheckmark aria-label="toggle todo" checked />);

    const checkmark = screen.getByRole("button", { name: "toggle todo" });
    expect(checkmark).not.toHaveClass("focus:ring-2");
    expect(checkmark).toHaveClass("focus:outline-none");
    expect(checkmark).toHaveClass("focus-visible:ring-2");
    expect(checkmark).toHaveClass("focus-visible:ring-app-focus/20");
  });

  it("renders compact and disabled todo checkmark states", () => {
    render(<TodoCheckmark aria-label="toggle todo" checked={false} size="sm" disabled />);

    const checkmark = screen.getByRole("button", { name: "toggle todo" });
    expect(checkmark).toHaveClass("omanote-todo-checkmark-sm");
    expect(checkmark).toHaveClass("omanote-todo-checkmark-bleed-sm");
    expect(checkmark).toHaveClass("omanote-todo-checkmark-disabled");
  });

  it("renders todo checkmarks as decorative spans inside larger controls", () => {
    render(<TodoCheckmark as="span" aria-hidden="true" checked size="sm" />);

    const checkmark = document.querySelector(".omanote-todo-checkmark");
    expect(checkmark?.tagName).toBe("SPAN");
    expect(checkmark).toHaveClass("omanote-todo-checkmark-done");
    expect(checkmark).not.toHaveClass("focus-visible:ring-2");
  });

  it("can align the visible todo checkmark chrome to text rows", () => {
    const { rerender } = render(<TodoCheckmark aria-label="toggle todo" checked={false} align="text" />);

    expect(screen.getByRole("button", { name: "toggle todo" })).toHaveClass("omanote-todo-checkmark-align-text-md");

    rerender(<TodoCheckmark aria-label="toggle todo" checked={false} size="sm" align="text" />);

    expect(screen.getByRole("button", { name: "toggle todo" })).toHaveClass("omanote-todo-checkmark-align-text-sm");
  });

  it("keeps text alignment offsets on todo checkmark tokens", () => {
    render(<TodoCheckmark aria-label="toggle todo" checked={false} align="text" />);

    expect(screen.getByRole("button", { name: "toggle todo" })).not.toHaveClass("mt-0.5");
    expect(screen.getByRole("button", { name: "toggle todo" })).not.toHaveClass("mt-1");
    expect(screen.getByRole("button", { name: "toggle todo" })).toHaveClass("omanote-todo-checkmark-align-text-md");
  });

  it("renders non-interactive badges as circular metadata", () => {
    render(<Badge tone="outline">High</Badge>);

    const badge = screen.getByText("High");
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass("rounded-app-chip");
    expect(badge).toHaveClass("border-app-line");
  });

  it("renders chips as rounded or circular selectable controls", () => {
    render(
      <>
        <Chip shape="rounded">#work</Chip>
        <Chip shape="circular" selected onClick={() => {}}>
          Active
        </Chip>
      </>,
    );

    expect(screen.getByText("#work")).toHaveClass("rounded-app-field");
    const activeChip = screen.getByRole("button", { name: "Active" });
    expect(activeChip).toHaveAttribute("aria-pressed", "true");
    expect(activeChip).toHaveClass("rounded-app-chip");
  });

  it("renders selectable option cards with chrome checkmarks", () => {
    render(
      <>
        <OptionCard selected>Selected</OptionCard>
        <OptionCard selected={false} current>Unselected</OptionCard>
      </>,
    );

    const selected = screen.getByRole("button", { name: "Selected" });
    expect(selected).toHaveClass("rounded-app-panel");
    expect(selected).toHaveClass("border-app-line-strong");
    expect(selected.querySelector(".omanote-todo-checkmark")?.tagName).toBe("SPAN");
    expect(selected.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
    const unselected = screen.getByRole("button", { name: "Unselected" });
    expect(unselected.querySelector(".omanote-todo-checkmark-open")).toBeInTheDocument();
    expect(unselected.querySelector(".omanote-option-card-current")).toBeInTheDocument();
  });

  it("renders surface primitives", () => {
    render(
      <>
        <Panel>Panel</Panel>
        <DialogSurface>Dialog</DialogSurface>
        <DrawerSurface>Drawer</DrawerSurface>
        <MenuItem>Menu</MenuItem>
      </>,
    );
    expect(screen.getByText("Panel")).toHaveClass("bg-app-surface");
    expect(screen.getByText("Dialog")).toHaveClass("bg-app-surface-raised");
    expect(screen.getByText("Drawer")).toHaveClass("bg-app-surface-raised");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveClass("hover:bg-app-surface-hover");
  });

  it("uses app token utilities for primitive sizing and motion", () => {
    render(
      <>
        <Button>Token button</Button>
        <Input aria-label="Token input" />
        <Panel>Token panel</Panel>
        <DialogSurface>Token dialog</DialogSurface>
        <DrawerSurface>Token drawer</DrawerSurface>
        <MenuItem>Token menu</MenuItem>
      </>,
    );

    expect(screen.getByRole("button", { name: "Token button" })).toHaveClass("rounded-app-button");
    expect(screen.getByLabelText("Token input")).toHaveClass("px-app-field-x");
    expect(screen.getByText("Token panel")).toHaveClass("rounded-app-panel");
    expect(screen.getByText("Token dialog")).toHaveClass("rounded-app-dialog");
    expect(screen.getByText("Token drawer")).toHaveClass("rounded-t-app-drawer");
    expect(screen.getByRole("button", { name: "Token menu" })).toHaveClass("gap-app-compact");
  });

  it("renders segmented navigation primitives with design-system classes", () => {
    render(
      <SegmentedShell>
        <SegmentedHighlight />
        <SegmentedItem active>Canvas</SegmentedItem>
        <SegmentedItem>Notes</SegmentedItem>
      </SegmentedShell>,
    );

    expect(screen.getByText("Canvas").parentElement).toHaveClass("omanote-segmented-shell");
    expect(document.querySelector(".omanote-segmented-highlight")).toBeInTheDocument();
    expect(document.querySelector(".omanote-segmented-highlight-shine")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Canvas" })).toHaveClass("omanote-segmented-item-active");
    expect(screen.getByRole("button", { name: "Notes" })).toHaveClass("omanote-segmented-item");
  });

  it("renders segmented pill variants with an animated active highlight", () => {
    render(
      <SegmentedPill
        activeKey="calendar"
        items={[
          { key: "calendar", label: "Calendar", icon: <span aria-hidden="true">C</span> },
          { key: "timeline", label: "Timeline" },
          { key: "compact", icon: <span aria-hidden="true">I</span>, ariaLabel: "Icon only" },
        ]}
        onChange={() => undefined}
        highlightTestId="segmented-pill-highlight"
      />,
    );

    const highlight = screen.getByTestId("segmented-pill-highlight");
    const calendar = screen.getByRole("button", { name: "Calendar" });
    const timeline = screen.getByRole("button", { name: "Timeline" });
    const iconOnly = screen.getByRole("button", { name: "Icon only" });

    expect(highlight).toHaveClass("omanote-segmented-highlight");
    expect(highlight).toHaveClass("rounded-full");
    expect(highlight).toHaveClass("duration-app-slow");
    expect(calendar).toHaveClass("gap-1.5");
    expect(calendar).toHaveClass("text-nav-active-ink");
    expect(timeline).toHaveClass("px-3");
    expect(iconOnly).toHaveClass("h-7");
    expect(iconOnly).toHaveClass("w-7");
  });

  it("renders segmented item labels with smooth reveal classes", () => {
    render(
      <>
        <SegmentedItemLabel visible withLeadingGap>Events</SegmentedItemLabel>
        <SegmentedItemLabel>Bookmarks</SegmentedItemLabel>
      </>,
    );

    expect(screen.getByText("Events")).toHaveClass("omanote-segmented-label");
    expect(screen.getByText("Events")).toHaveClass("omanote-segmented-label-visible");
    expect(screen.getByText("Events")).toHaveClass("omanote-segmented-label-gap");
    expect(screen.getByText("Bookmarks")).toHaveClass("omanote-segmented-label");
    expect(screen.getByText("Bookmarks")).not.toHaveClass("omanote-segmented-label-visible");
    expect(screen.getByText("Bookmarks")).not.toHaveClass("omanote-segmented-label-gap");
  });

  it("keeps segmented active motion on frequent-control timing tokens", () => {
    render(
      <SegmentedShell>
        <SegmentedHighlight />
        <SegmentedItemLabel visible>Canvas</SegmentedItemLabel>
      </SegmentedShell>,
    );

    const highlight = document.querySelector(".omanote-segmented-highlight");
    const label = screen.getByText("Canvas");

    expect(highlight).toHaveClass("duration-app-base");
    expect(label).toHaveClass("duration-app-fast");
  });

  it("exposes segmented item classes for router-owned links", () => {
    expect(segmentedItemClass({ active: true, className: "px-3 text-app-ink-muted" })).toContain("omanote-segmented-item-active");
    expect(segmentedItemClass({ active: true, className: "px-3 text-app-ink-muted" })).toContain("text-nav-active-ink");
    expect(segmentedItemClass({ active: true, className: "px-3 text-app-ink-muted" })).not.toContain("text-app-ink-muted");
    expect(segmentedItemClass({ active: false, className: "px-3" })).not.toContain("omanote-segmented-item-active");
  });

  it("renders the date strip active highlight primitive", () => {
    render(<DateStripHighlight />);

    expect(document.querySelector(".omanote-date-active-highlight")).toBeInTheDocument();
  });
});
