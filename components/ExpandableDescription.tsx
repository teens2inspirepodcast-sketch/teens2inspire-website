"use client";

import { useEffect, useRef, useState } from "react";

type ExpandableDescriptionProps = {
  text: string;
  className?: string;
  label?: string;
};

export function ExpandableDescription({ text, className = "", label = "description" }: ExpandableDescriptionProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;

    const measureOverflow = () => setCanExpand(element.scrollHeight > element.clientHeight + 1);
    measureOverflow();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div className={`expandable-description ${className}`.trim()}>
      <p ref={textRef} className={`expandable-description-text${expanded ? " is-expanded" : ""}`}>
        {text}
      </p>
      {(canExpand || expanded) && (
        <button
          type="button"
          className="expandable-description-toggle"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Show less of" : "See all of"} ${label}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "See less" : "See all"}
        </button>
      )}
    </div>
  );
}
