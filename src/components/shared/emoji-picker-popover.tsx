"use client";

import { useState } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Smile, X } from "lucide-react";
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

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEmojiSelect(null);
    setOpen(false);
  };

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
          className="w-auto p-0 border-none shadow-lg"
          align="start"
          side="right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            {emoji && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 z-10 h-7 text-xs"
                onClick={handleClear}
                data-testid="button-clear-emoji"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={Theme.AUTO}
              width={320}
              height={400}
              searchPlaceholder="Search emoji..."
              lazyLoadEmojis
            />
          </div>
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
        className="w-auto p-0 border-none shadow-lg"
        align="start"
        side="right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {emoji && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 z-10 h-7 text-xs"
              onClick={handleClear}
              data-testid="button-clear-emoji"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.AUTO}
            width={320}
            height={400}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
