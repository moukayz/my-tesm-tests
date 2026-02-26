type LoadingSpinnerProps = {
  label?: string;
};

export default function LoadingSpinner({ label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-200">
      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-amber-400" />
      <span>{label}</span>
    </div>
  );
}
