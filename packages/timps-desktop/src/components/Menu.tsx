/**
 * TIMPS Desktop - Menu
 * Dropdown menu and navigation menu.
 */

import { useState, useRef, useEffect } from 'react';
import './Menu.css';

interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  onSelect: (id: string) => void;
  trigger?: React.ReactNode;
}

export function Menu({ items, onSelect, trigger }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="menu-wrapper" ref={menuRef}>
      <div className="menu-trigger" onClick={() => setIsOpen(!isOpen)}>
        {trigger || <button>Menu</button>}
      </div>
      {isOpen && (
        <div className="menu">
          {items.map(item => (
            item.divider ? (
              <div key={item.id} className="menu-divider" />
            ) : (
              <button
                key={item.id}
                className={`menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (!item.disabled) {
                    onSelect(item.id);
                    setIsOpen(false);
                  }
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

interface NavMenuProps {
  items: { id: string; label: string; icon?: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function NavMenu({ items, active, onChange }: NavMenuProps) {
  return (
    <nav className="nav-menu">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
}

export function Dropdown({ trigger, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="dropdown-wrapper" ref={dropdownRef}>
      <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && <div className="dropdown-content">{children}</div>}
    </div>
  );
}

interface ActionMenuProps {
  actions: { icon: string; label: string; onClick: () => void }[];
}

export function ActionMenu({ actions }: ActionMenuProps) {
  return (
    <div className="action-menu">
      {actions.map((action, index) => (
        <button key={index} onClick={action.onClick}>
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}