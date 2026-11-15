import React, { useState, useRef, useEffect } from 'react';
import '../styles/dropdown.css';

interface MultiSelectDropdownProps {
  options: readonly string[] | string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = 'اختر الخيارات...',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function toggleOption(option: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className={`multiselect-container ${isOpen ? 'open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className="multiselect-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="multiselect-values">
          {selected.length === 0 ? (
            <span className="multiselect-placeholder">{placeholder}</span>
          ) : (
            selected.map((item) => (
              <span key={item} className="multiselect-tag">
                {item}
              </span>
            ))
          )}
        </div>
        <span className="multiselect-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="multiselect-menu" role="listbox">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <div
                key={option}
                className={`multiselect-option ${isSelected ? 'selected' : ''}`}
                onClick={(e) => toggleOption(option, e)}
                role="option"
                aria-selected={isSelected}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} // Handled by container onClick
                />
                <span>{option}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
