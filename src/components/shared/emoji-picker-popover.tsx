"use client";

import { useState } from "react";
import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmojiPickerPopoverProps {
  emoji: string | null;
  onEmojiSelect: (emoji: string | null) => void;
  disabled?: boolean;
  className?: string;
  variant?: "inline" | "area";
  testId?: string;
}

export function EmojiPickerPopover({
  emoji,
  onEmojiSelect,
  disabled = false,
  className,
  variant = "inline",
  testId = "button-emoji-picker",
}: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiSelect = ({ emoji: selectedEmoji }: { emoji: string }) => {
    onEmojiSelect(selectedEmoji);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEmojiSelect(null);
    setOpen(false);
  };

  const emojiPickerContent = (
    <div className="relative">
      {emoji && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 h-7 text-xs gap-1"
          onClick={handleClear}
          data-testid="button-clear-emoji"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
      <EmojiPicker.Root
        className="isolate flex h-[340px] w-[320px] flex-col bg-popover text-popover-foreground"
        onEmojiSelect={handleEmojiSelect}
      >
        <div className="relative mx-2 mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <EmojiPicker.Search
            placeholder="Search emoji..."
            className="w-full appearance-none rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <EmojiPicker.Viewport className="relative flex-1 outline-hidden mt-2">
          <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List
            className="select-none pb-1.5"
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  className="bg-popover px-3 pt-3 pb-1.5 font-medium text-muted-foreground text-xs sticky top-0 z-10"
                  {...props}
                >
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div className="scroll-my-1.5 px-1.5" {...props}>
                  {children}
                </div>
              ),
              Emoji: ({ emoji: emojiData, ...props }) => (
                <button
                  className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent data-[active]:bg-accent transition-colors"
                  {...props}
                >
                  {emojiData.emoji}
                </button>
              ),
            }}
          />
        </EmojiPicker.Viewport>
      </EmojiPicker.Root>
    </div>
  );

  if (variant === "area") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "w-12 h-12 rounded-md bg-muted flex items-center justify-center cursor-pointer hover-elevate flex-shrink-0 group/emoji",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
            data-testid={testId}
            onClick={(e) => e.stopPropagation()}
          >
            {emoji ? (
              <span className="text-2xl">{emoji}</span>
            ) : (
              <Smile className="h-5 w-5 text-muted-foreground group-hover/emoji:text-foreground transition-colors" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 border shadow-lg rounded-lg overflow-hidden"
          align="start"
          side="right"
          onClick={(e) => e.stopPropagation()}
        >
          {emojiPickerContent}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-6 w-6 p-0 rounded-sm flex-shrink-0",
            !emoji && "opacity-0 group-hover:opacity-100 transition-opacity",
            className
          )}
          data-testid={testId}
          onClick={(e) => e.stopPropagation()}
        >
          {emoji ? (
            <span className="text-base">{emoji}</span>
          ) : (
            <Smile className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border shadow-lg rounded-lg overflow-hidden"
        align="start"
        side="right"
        onClick={(e) => e.stopPropagation()}
      >
        {emojiPickerContent}
      </PopoverContent>
    </Popover>
  );
}
