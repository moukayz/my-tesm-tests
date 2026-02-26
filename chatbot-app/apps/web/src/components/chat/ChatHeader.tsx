import BranchSelector from "@/components/chat/BranchSelector";
import ModelSelector from "@/components/chat/ModelSelector";
import type { Model } from "@/lib/contracts";
import type { LocalBranch, LocalChat } from "@/lib/localTypes";
import { formatChatTitle } from "@/lib/format";

type ChatHeaderProps = {
  chat: LocalChat;
  branches: LocalBranch[];
  selectedBranchId: string | null;
  onBranchChange: (value: string) => void;
  models: Model[];
  selectedModelId: string | null;
  onModelChange: (value: string) => void;
};

export default function ChatHeader({
  chat,
  branches,
  selectedBranchId,
  onBranchChange,
  models,
  selectedModelId,
  onModelChange,
}: ChatHeaderProps) {
  return (
    <div className="border-b border-slate-800/80 bg-slate-950/60 px-6 py-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">
              {formatChatTitle(chat.title)}
            </h2>
            <p className="text-xs text-slate-400">Chat model: {chat.model_id}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <BranchSelector
              branches={branches}
              selectedId={selectedBranchId}
              onChange={onBranchChange}
              disabled={branches.length === 0}
            />
          </div>
        </div>
        <div className="md:hidden">
          <ModelSelector
            models={models}
            selectedId={selectedModelId}
            onChange={onModelChange}
          />
        </div>
      </div>
    </div>
  );
}
