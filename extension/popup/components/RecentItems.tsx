import type { RecentItem } from "../../shared/types";

interface RecentItemsProps {
  items: RecentItem[];
}

const BADGE_CLASS: Record<RecentItem["type"], string> = {
  note: "badge-note",
  bookmark: "badge-bookmark",
  todo: "badge-todo",
};

export function RecentItems({ items }: RecentItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="section">
      <div className="section-title">Recent</div>
      {items.slice(0, 4).map((item) => (
        <div className="recent-item" key={item.id}>
          <span className={`recent-type-badge ${BADGE_CLASS[item.type]}`}>{item.type}</span>
          <span className="recent-title" title={item.title}>{item.title}</span>
        </div>
      ))}
    </div>
  );
}
