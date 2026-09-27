"use client";

/** A one-field edit: the stock Dialog with a title, one input (or textarea), Cancel and Save. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function EditFieldDialog({
  open,
  onOpenChange,
  title,
  initialValue,
  placeholder,
  multiline = false,
  saving = false,
  onSave,
  testId,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue: string;
  placeholder?: string;
  multiline?: boolean;
  saving?: boolean;
  onSave: (value: string) => void;
  testId: string;
  /** Replaces the text input (e.g. a select). */
  children?: React.ReactNode;
}) {
  const [value, setValue] = React.useState(initialValue);
  React.useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children ??
          (multiline ? (
            <Textarea
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="min-h-28 text-sm"
              style={{ fontSize: "16px" }}
              autoFocus
              data-testid={`input-${testId}`}
            />
          ) : (
            <Input
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave(value);
                }
              }}
              autoFocus
              style={{ fontSize: "16px" }}
              data-testid={`input-${testId}`}
            />
          ))}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(value)} disabled={saving} data-testid={`button-save-${testId}`}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
