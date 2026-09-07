"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { RegistrationLink } from "./registration-link";
import styles from "./mobile-navigation.module.css";

const navigationItems = [
  ["Informasi Acara", "#informasi"],
  ["Rundown Acara", "#rundown"],
  ["Paket & Biaya", "#paket"],
  ["Informasi Perjalanan", "/travel"],
  ["Rapat Anggota", "/rapat-anggota"],
] as const;

type MobileNavigationProps = {
  showRegistrationCta?: boolean;
};

export function MobileNavigation({
  showRegistrationCta = false,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        navigationRef.current &&
        !navigationRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.root} ref={navigationRef}>
      <button
        aria-controls="mobile-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Tutup navigasi" : "Buka navigasi"}
        className={styles.menuButton}
        onClick={() => setIsOpen((open) => !open)}
        ref={buttonRef}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`${styles.menuIcon} ${isOpen ? styles.menuIconOpen : ""}`}
        />
      </button>

      <div
        aria-label="Navigasi utama"
        className={styles.panel}
        hidden={!isOpen}
        id="mobile-navigation"
      >
        <nav>
          {navigationItems.map(([label, href]) => (
            <Link
              className={styles.navLink}
              href={href}
              key={href}
              onClick={() => setIsOpen(false)}
            >
              {label}
            </Link>
          ))}
          {showRegistrationCta ? (
            <RegistrationLink className={styles.registrationLink} />
          ) : null}
        </nav>
      </div>
    </div>
  );
}
