"use client";

import { useState } from "react";
import "./mobileFilterAccordion.scss";

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface MobileFilterAccordionProps<T extends string> {
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export default function MobileFilterAccordion<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: MobileFilterAccordionProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  if (!selectedOption) return null;

  return (
    <div className={`mobile-filter-accordion ${isOpen ? "is-open" : ""}`}>
      <button
        type="button"
        className="mobile-filter-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>
          {selectedOption.label}
          {selectedOption.count !== undefined && (
            <strong>{selectedOption.count}</strong>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="mobile-filter-panel">
        <div>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={option.value === value ? "is-selected" : ""}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.count !== undefined && <em>{option.count}</em>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
