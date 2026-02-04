"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SocialPostCardProps {
  author: string;
  authorImage?: string | null;
  caption?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  likes?: number | null;
  postedAt?: Date | string | null;
  permalink?: string | null;
  source?: 'instagram' | 'tiktok' | 'manual';
  className?: string;
}

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

export function SocialPostCard({
  permalink,
  source = 'instagram',
  className,
}: SocialPostCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!permalink || source !== 'instagram') return;

    const loadInstagramEmbed = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      } else {
        const script = document.createElement('script');
        script.src = 'https://www.instagram.com/embed.js';
        script.async = true;
        script.onload = () => {
          if (window.instgrm) {
            window.instgrm.Embeds.process();
          }
        };
        document.body.appendChild(script);
      }
    };

    loadInstagramEmbed();
  }, [permalink, source]);

  if (!permalink) {
    return null;
  }

  if (source === 'instagram') {
    return (
      <div ref={containerRef} className={cn("overflow-hidden", className)}>
        <blockquote
          className="instagram-media"
          data-instgrm-captioned
          data-instgrm-permalink={permalink}
          data-instgrm-version="14"
          style={{
            background: '#FFF',
            border: 0,
            borderRadius: '3px',
            boxShadow: '0 0 1px 0 rgba(0,0,0,0.5), 0 1px 10px 0 rgba(0,0,0,0.15)',
            margin: '1px',
            maxWidth: '540px',
            minWidth: '326px',
            padding: 0,
            width: 'calc(100% - 2px)',
          }}
        >
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:underline"
          >
            View this post on Instagram
          </a>
        </blockquote>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg bg-card p-4", className)}>
      <a
        href={permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline"
      >
        View original post
      </a>
    </div>
  );
}
