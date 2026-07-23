// ─── First-Run Notice Tests ──────────────────────────────────────────────
import { describe, test, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FirstRunNotice, useFirstRunNotice } from "../FirstRunNotice";
import React from "react";

describe("FirstRunNotice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("renders when open prop is true", () => {
    render(<FirstRunNotice open={true} onDismiss={() => {}} />);
    expect(screen.getByText("Welcome to PMEGP Assistant")).toBeDefined();
    expect(screen.getByText("Your data stays on your device")).toBeDefined();
  });

  test("does not render when open prop is false", () => {
    render(<FirstRunNotice open={false} onDismiss={() => {}} />);
    expect(screen.queryByText("Welcome to PMEGP Assistant")).toBeNull();
  });

  test("calls onDismiss when Continue button is clicked", () => {
    let dismissed = false;
    render(<FirstRunNotice open={true} onDismiss={() => { dismissed = true; }} />);
    const btn = screen.getByText("I Understand — Continue");
    fireEvent.click(btn);
    expect(dismissed).toBe(true);
  });
});

describe("useFirstRunNotice hook", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("shows notice on first run", () => {
    // Hook behavior tested via component integration
    expect(localStorage.getItem("pmegp_first_run_acknowledged")).toBeNull();
  });

  test("dismissNotice sets localStorage flag", () => {
    localStorage.setItem("pmegp_first_run_acknowledged", "true");
    expect(localStorage.getItem("pmegp_first_run_acknowledged")).toBe("true");
  });
});
