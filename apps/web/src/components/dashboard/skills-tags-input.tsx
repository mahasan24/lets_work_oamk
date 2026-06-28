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
  helperText?: string;
  maxSuggestions?: number;
};

function normalizeSkill(skill: string) {
  return skill.trim().replace(/\s+/g, " ");
}

export function SkillsTagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type a skill and press Enter",
  helperText = "Choose from suggestions or type a custom skill and press Enter.",
  maxSuggestions = 12,
}: SkillsTagsInputProps) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const anchorRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    const query = input.trim().toLowerCase();
    if (!query) {
      return suggestions.filter((skill) => !value.includes(skill)).slice(0, maxSuggestions);
    }

    return suggestions
      .filter((skill) => skill.toLowerCase().includes(query) && !value.includes(skill))
      .slice(0, maxSuggestions);
  }, [input, maxSuggestions, suggestions, value]);

  const trimmedInput = input.trim();
  const canAddCustom =
    trimmedInput.length > 0 &&
    !value.some((skill) => skill.toLowerCase() === trimmedInput.toLowerCase()) &&
    !filteredSuggestions.some((skill) => skill.toLowerCase() === trimmedInput.toLowerCase());

  const showSuggestions =
    focused && (filteredSuggestions.length > 0 || canAddCustom);

  useEffect(() => {
    if (!showSuggestions || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const menuHeight = 240;
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
  }, [showSuggestions, input, filteredSuggestions.length, canAddCustom]);

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
            className="max-h-60 overflow-y-auto border border-border bg-popover shadow-md"
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
            ) : null}
            {canAddCustom ? (
              <button
                type="button"
                className="w-full border-t px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addSkill(input)}
              >
                Add custom skill &quot;{trimmedInput}&quot;
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-2">
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
              if (trimmedInput) addSkill(input);
            }
            if (e.key === "Backspace" && !input && value.length > 0) {
              removeSkill(value[value.length - 1]!);
            }
          }}
        />
      </div>

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}

      {suggestionsMenu}
    </div>
  );
}
