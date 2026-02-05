"use client";

import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Utensils, 
  Calendar, 
  Star, 
  Leaf, 
  Wine,
  Tag as TagIcon,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TagInfo {
  id: string;
  slug: string;
  displayName: string;
  categorySlug?: string;
  iconName?: string | null;
}

export interface TagCategoryGroup {
  category: {
    slug: string;
    displayName: string;
    iconName?: string | null;
    searchWeight?: number;
  };
  tags: TagInfo[];
}

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  vibe: Sparkles,
  "food-type": Utensils,
  occasion: Calendar,
  features: Star,
  dietary: Leaf,
  drinks: Wine,
};

const CATEGORY_COLORS: Record<string, string> = {
  vibe: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "food-type": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  occasion: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  features: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  dietary: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  drinks: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

interface InlineTagsProps {
  tags: TagInfo[];
  maxTags?: number;
  size?: "sm" | "default";
  className?: string;
}

export function InlineTags({ tags, maxTags = 3, size = "sm", className }: InlineTagsProps) {
  if (!tags || tags.length === 0) return null;

  const displayTags = tags.slice(0, maxTags);
  const remaining = tags.length - maxTags;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn(
            "no-default-hover-elevate no-default-active-elevate border-0",
            size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
          )}
          data-testid={`tag-${tag.slug}`}
        >
          {tag.displayName}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge
          variant="secondary"
          className={cn(
            "no-default-hover-elevate no-default-active-elevate border-0 bg-muted text-muted-foreground",
            size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
          )}
          data-testid="tag-remaining-count"
        >
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

interface GroupedTagsProps {
  tagGroups: TagCategoryGroup[];
  className?: string;
}

export function GroupedTags({ tagGroups, className }: GroupedTagsProps) {
  if (!tagGroups || tagGroups.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {tagGroups.map((group) => (
        <div key={group.category.slug} className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">{group.category.displayName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="no-default-hover-elevate no-default-active-elevate border-0"
                data-testid={`tag-${tag.slug}`}
              >
                {tag.displayName}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface CompactTagsProps {
  tags: TagInfo[];
  maxTags?: number;
  className?: string;
}

export function CompactTags({ tags, maxTags = 2, className }: CompactTagsProps) {
  if (!tags || tags.length === 0) return null;

  const displayTags = tags.slice(0, maxTags);

  return (
    <span className={cn("text-xs text-muted-foreground truncate", className)}>
      {displayTags.map(t => t.displayName).join(" · ")}
    </span>
  );
}

interface TagsWithPopoverProps {
  category: string;
  tags: TagInfo[];
  tagGroups?: TagCategoryGroup[];
  maxInlineTags?: number;
  className?: string;
}

export function TagsWithPopover({ 
  category, 
  tags, 
  tagGroups = [], 
  maxInlineTags = 2,
  className 
}: TagsWithPopoverProps) {
  const displayTags = tags.slice(0, maxInlineTags);
  const tagNames = displayTags.map(t => t.displayName).join(", ");
  const hasMoreTags = tagGroups.length > 0 && tagGroups.some(g => g.tags.length > 0);

  return (
    <div className={cn("flex items-center gap-1 text-base text-black flex-nowrap overflow-hidden", className)}>
      <span className="whitespace-nowrap">{category}</span>
      {tagNames && (
        <>
          <span className="text-muted-foreground mx-1">—</span>
          <span className="truncate">{tagNames}</span>
        </>
      )}
      {hasMoreTags && (
        <>
          <span className="text-muted-foreground">,</span>
          <Popover>
            <PopoverTrigger asChild>
              <span 
                className="text-muted-foreground cursor-pointer underline decoration-dotted underline-offset-4 hover:text-foreground transition-colors "
                data-testid="text-view-all-tags"
              >
                View all
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <GroupedTags tagGroups={tagGroups} />
            </PopoverContent>
          </Popover>
        </>
      )}
    </div>
  );
}
