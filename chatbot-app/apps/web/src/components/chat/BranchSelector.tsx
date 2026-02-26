import type { LocalBranch } from "@/lib/localTypes";
import { formatTime } from "@/lib/format";

type BranchSelectorProps = {
  branches: LocalBranch[];
  selectedId: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function BranchSelector({
  branches,
  selectedId,
  onChange,
  disabled = false,
}: BranchSelectorProps) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-300" data-testid="branch-selector-label">
      Branch
      <select
        className="rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        value={selectedId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || branches.length === 0}
        data-testid="branch-selector"
      >
        {branches.length === 0 ? (
          <option value="">No branches yet</option>
        ) : null}
        {branches.map((branch, index) => (
          <option key={branch.id} value={branch.id}>
            {`Branch ${index + 1}`} {formatTime(branch.created_at)}
          </option>
        ))}
      </select>
    </label>
  );
}
