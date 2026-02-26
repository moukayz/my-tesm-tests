import type { Model } from "@/lib/contracts";

type ModelSelectorProps = {
  models: Model[];
  selectedId: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function ModelSelector({
  models,
  selectedId,
  disabled,
  onChange,
}: ModelSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-300" data-testid="model-selector-label">
      Model
      <select
        className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 disabled:cursor-not-allowed disabled:opacity-60"
        value={selectedId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label="Model selector"
        data-testid="model-selector"
      >
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}
