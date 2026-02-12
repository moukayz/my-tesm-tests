"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import React from "react";
import { Button } from "@/shared/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
  pending,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/35" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-[var(--radius)] border border-card-border bg-[color:var(--bg)] p-5 shadow-[var(--shadow)]">
          <DialogTitle className="font-serif text-xl">
            {title}
          </DialogTitle>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={danger ? "danger" : "primary"}
              onClick={onConfirm}
              disabled={pending}
              data-testid="confirm-dialog-confirm"
            >
              {pending ? "Working..." : confirmLabel}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
