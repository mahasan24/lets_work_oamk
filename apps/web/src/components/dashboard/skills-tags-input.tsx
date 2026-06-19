import { Badge } from "@lets_work/ui/components/badge";
import { Input } from "@lets_work/ui/components/input";
import { XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SkillsTagsInputProps = {
  value: string[];
  onChange: (skills: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

function normalizeSkill(skill: string) {
  return skill.trim().replace(/\s+/g, " ");
}

export function SkillsTagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type a skill and press Enter",
}: SkillsTagsInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    const query = input.trim().toLowerCase();
    if (!query) return suggestions.filter((s) => !value.includes(s)).slice(0, 8);
    return suggestions
      .filter((s) => s.toLowerCase().includes(query) && !value.includes(s))
      .slice(0, 8);
  }, [input, suggestions, value]);

  const showSuggestions = focused && (filteredSuggestions.length > 0 || input.trim().length > 0);

  useEffect(() => {
    if (!showSuggestions || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuHeight = 192;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        top: openUpward ? rect.top - 8 : rect.bottom + 4,
        transform: openUpward ? "translateY(-100%)" : undefined,
        zIndex: 50,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showSuggestions, input, filteredSuggestions.length]);

  const addSkill = (skill: string) => {
    const normalized = normalizeSkill(skill);
    if (!normalized) return;
    if (value.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) return;
    onChange([...value, normalized]);
    setInput("");
  };

  const removeSkill = (skill: string) => {
    onChange(value.filter((item) => item !== skill));
  };

  const suggestionsMenu =
    showSuggestions && typeof document !== "undefined"
      ? createPortal(
          <div
            style={menuStyle}
            className="max-h-48 overflow-y-auto border border-border bg-popover shadow-md"
          >
            {filteredSuggestions.length > 0 ? (
              <ul className="py-1">
                {filteredSuggestions.map((skill) => (
                  <li key={skill}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addSkill(skill)}
                    >
                      {skill}
                    </button>
                  </li>
                ))}
              </ul>
            ) : input.trim() ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addSkill(input)}
              >
                Add &quot;{input.trim()}&quot;
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {value.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 py-0.5 pr-1 pl-2 text-xs">
            {skill}
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => removeSkill(skill)}
              aria-label={`Remove ${skill}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div ref={anchorRef} className="relative">
        <Input
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSkill(input);
            }
            if (e.key === "Backspace" && !input && value.length > 0) {
              removeSkill(value[value.length - 1]!);
            }
          }}
        />
      </div>

      {suggestionsMenu}
    </div>
  );
}
