"use client";

import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SocialPostCardProps {
  author: string;
  authorImage?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null; // 'image' | 'video' | 'carousel'
  likes?: number | null;
  postedAt?: Date | string | null;
  permalink?: string | null;
  source?: 'instagram' | 'tiktok' | 'manual';
  className?: string;
}

export function SocialPostCard({
  author,
  authorImage,
  caption,
  mediaUrl,
  mediaType = 'image',
  likes,
  postedAt,
  permalink,
  source = 'instagram',
  className,
}: SocialPostCardProps) {
  const initials = author?.slice(0, 2).toUpperCase() || '??';
  
  const formattedDate = postedAt 
    ? formatDistanceToNow(new Date(postedAt), { addSuffix: true })
    : null;

  const formattedLikes = likes 
    ? likes >= 1000 
      ? `${(likes / 1000).toFixed(1)}k` 
      : likes.toString()
    : null;

  const handleOpenOriginal = () => {
    if (permalink) {
      window.open(permalink, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", className)}>
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={authorImage || undefined} alt={author} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{author}</p>
        </div>
        {permalink && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleOpenOriginal}
            data-testid="button-open-original-post"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>

      {mediaUrl && (
        <div className="relative aspect-square bg-muted">
          {mediaType === 'video' ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              controls
              playsInline
            />
          ) : (
            <img
              src={mediaUrl}
              alt={caption || 'Post image'}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="no-default-hover-elevate">
            <Heart className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="no-default-hover-elevate">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="no-default-hover-elevate">
            <Send className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="no-default-hover-elevate">
            <Bookmark className="h-5 w-5" />
          </Button>
        </div>

        {formattedLikes && (
          <p className="text-sm font-semibold">{formattedLikes} likes</p>
        )}

        {caption && (
          <p className="text-sm">
            <span className="font-semibold">{author}</span>{' '}
            <span className="text-muted-foreground">{caption}</span>
          </p>
        )}

        {formattedDate && (
          <p className="text-xs text-muted-foreground uppercase">{formattedDate}</p>
        )}

        {source !== 'manual' && (
          <p className="text-xs text-muted-foreground">
            via {source === 'instagram' ? 'Instagram' : 'TikTok'}
          </p>
        )}
      </div>
    </div>
  );
}
