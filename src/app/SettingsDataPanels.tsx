import { ExportDataPanel } from "../components/ExportDataModal";
import { ImportDataPanel } from "../components/ImportDataModal";

export function SettingsDataPanels() {
  return (
    <>
      <ExportDataPanel />

      <div className="my-8 border-t border-app-line" />

      <h2 className="text-lg font-bold text-app-ink">Import Data</h2>
      <p className="mt-1 text-sm leading-relaxed text-app-ink-faint">
        Restore items from an omanote export file.
      </p>
      <ImportDataPanel />
    </>
  );
}
