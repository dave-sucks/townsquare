"use client";

import { useState } from "react";
import { EmojiPicker } from "frimousse";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { SmileIcon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS = [
  { id: "smileys-emotion", icon: "\u{1F600}", label: "Smileys", dataLabel: "smileys-&-emotion" },
  { id: "people-body", icon: "\u{1F44B}", label: "People", dataLabel: "people-&-body" },
  { id: "animals-nature", icon: "\u{1F43B}", label: "Animals", dataLabel: "animals-&-nature" },
  { id: "food-drink", icon: "\u{1F354}", label: "Food", dataLabel: "food-&-drink" },
  { id: "travel-places", icon: "\u{2708}\u{FE0F}", label: "Travel", dataLabel: "travel-&-places" },
  { id: "activities", icon: "\u{26BD}", label: "Activities", dataLabel: "activities" },
  { id: "objects", icon: "\u{1F4A1}", label: "Objects", dataLabel: "objects" },
  { id: "symbols", icon: "\u{2764}\u{FE0F}", label: "Symbols", dataLabel: "symbols" },
  { id: "flags", icon: "\u{1F3F3}\u{FE0F}", label: "Flags", dataLabel: "flags" },
];

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
    <div className="relative touch-manipulation" data-testid="emoji-picker-container">
      <EmojiPicker.Root
        className="isolate flex h-[340px] w-fit flex-col bg-popover text-popover-foreground touch-manipulation"
        onEmojiSelect={handleEmojiSelect}
      >
        <div className="mx-2 mt-2">
          <div className="relative flex items-center rounded-md border border-input bg-background touch-manipulation">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <EmojiPicker.Search
              placeholder="Search emoji..."
              className="flex-1 h-9 bg-transparent pl-8 pr-8 text-[16px] placeholder:text-muted-foreground focus:outline-none touch-manipulation [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              data-testid="input-emoji-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {emoji && (
              <button
                onClick={handleClear}
                className="absolute right-2 h-6 w-6 flex items-center justify-center rounded-sm hover-elevate text-muted-foreground"
                data-testid="button-clear-emoji"
                aria-label="Clear emoji"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border touch-manipulation">
          {CATEGORY_ICONS.map((cat) => (
            <button
              key={cat.id}
              className="flex items-center justify-center w-7 h-7 rounded-md text-base hover-elevate touch-manipulation"
              title={cat.label}
              data-testid={`button-category-${cat.id}`}
              onClick={(e) => {
                e.preventDefault();
                const categoryElement = document.querySelector(
                  `[data-testid="text-emoji-category-${cat.dataLabel}"]`
                ) as HTMLElement;
                if (categoryElement) {
                  categoryElement.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              {cat.icon}
            </button>
          ))}
        </div>
        <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
          <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm" data-testid="text-emoji-loading">
            Loading...
          </EmojiPicker.Loading>
          <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm" data-testid="text-emoji-empty">
            No emoji found.
          </EmojiPicker.Empty>
          <EmojiPicker.List
            className="select-none pb-1.5"
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  className="bg-popover px-3 pt-3 pb-1.5 font-medium text-muted-foreground text-xs sticky top-0 z-10"
                  data-testid={`text-emoji-category-${category.label.replace(/\s+/g, "-").toLowerCase()}`}
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
                  className="flex size-8 items-center justify-center rounded-md text-lg hover-elevate"
                  data-testid={`button-emoji-${emojiData.label.replace(/\s+/g, "-").toLowerCase()}`}
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
          <div
            className={cn(
              "w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0 cursor-pointer hover-elevate",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none",
              className
            )}
            data-testid={testId}
            onClick={(e) => e.stopPropagation()}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
          >
            {emoji ? (
              <span className="text-2xl" data-testid="text-selected-emoji">{emoji}</span>
            ) : (
              <HugeiconsIcon icon={SmileIcon} className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
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
            "flex-shrink-0",
            !emoji && "invisible group-hover:visible group-focus-within:visible focus:visible",
            className
          )}
          data-testid={testId}
          onClick={(e) => e.stopPropagation()}
        >
          {emoji ? (
            <span className="text-base" data-testid="text-selected-emoji">{emoji}</span>
          ) : (
            <HugeiconsIcon icon={SmileIcon} className="h-3.5 w-3.5 text-muted-foreground" />
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
