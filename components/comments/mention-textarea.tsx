"use client";

import { useRef, useState } from "react";
import { getInitials } from "@/lib/utils";
import type { Member } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";

/**
 * Textarea with a lightweight @mention picker.
 * Typing "@" opens a member list; picking inserts a token of the form
 * `@[Name](userId)`, which the server parses into mention notifications.
 */
export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  members,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  members: Member[];
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const matches =
    mentionQuery !== null
      ? members
          .filter((m) => m.user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    // Detect "@query" right before the caret.
    const caret = e.target.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const match = before.match(/(?:^|\s)@([\w]*)$/);
    setMentionQuery(match ? match[1] : null);
    setHighlightIndex(0);
  }

  function insertMention(member: Member) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\w]*)$/, "");
    const after = value.slice(caret);
    const token = `@[${member.user.name}](${member.userId}) `;
    onChange(before + token + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = (before + token).length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[highlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      {mentionQuery !== null && matches.length > 0 && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-md border bg-popover shadow-lg">
          {matches.map((m, i) => (
            <button
              key={m.userId}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm ${
                i === highlightIndex ? "bg-accent" : ""
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <Avatar className="h-5 w-5">
                {m.user.image && <AvatarImage src={m.user.image} alt="" />}
                <AvatarFallback className="text-[9px]">{getInitials(m.user.name)}</AvatarFallback>
              </Avatar>
              {m.user.name}
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        className="min-h-[40px] resize-none"
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
