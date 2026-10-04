import { ALLOWED_IMAGE_TYPES, CATEGORIES, COLORS, LOCATIONS, MAX_IMAGE_SIZE } from "./constants";
import type { ReportFormInput, ValidationResult } from "./types";

function result(errors: Record<string, string>): ValidationResult {
  return { valid: Object.keys(errors).length === 0, errors };
}

function isAllowed<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  const errors: Record<string, string> = {};

  if (!trimmed) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
    errors.email = "Enter a valid email address.";
  }

  return result(errors);
}

export function validatePassword(password: string): ValidationResult {
  const errors: Record<string, string> = {};

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return result(errors);
}

export function validateFullName(fullName: string): ValidationResult {
  const trimmed = fullName.trim();
  const errors: Record<string, string> = {};

  if (!trimmed) {
    errors.full_name = "Full name is required.";
  } else if (trimmed.length < 2 || trimmed.length > 80) {
    errors.full_name = "Full name must be between 2 and 80 characters.";
  }

  return result(errors);
}

export function validateImage(file: File | null): ValidationResult {
  const errors: Record<string, string> = {};

  if (!file) {
    return result(errors);
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    errors.image = "Use a JPEG, PNG, or WebP image.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    errors.image = "Image must be 5 MB or smaller.";
  }

  return result(errors);
}

export function validateReportForm(input: ReportFormInput): ValidationResult {
  const errors: Record<string, string> = {};
  const itemName = input.item_name.trim();
  const description = input.description.trim();

  if (input.type !== "lost" && input.type !== "found") {
    errors.type = "Choose lost or found.";
  }

  if (itemName.length < 2 || itemName.length > 80) {
    errors.item_name = "Item name must be between 2 and 80 characters.";
  }

  if (!isAllowed(CATEGORIES, input.category)) {
    errors.category = "Choose a valid category.";
  }

  if (!isAllowed(COLORS, input.color)) {
    errors.color = "Choose a valid color.";
  }

  if (!isAllowed(LOCATIONS, input.location)) {
    errors.location = "Choose a valid location.";
  }

  if (!input.event_date) {
    errors.event_date = "Event date is required.";
  } else if (!isValidCalendarDate(input.event_date)) {
    errors.event_date = "Use a valid date in YYYY-MM-DD format.";
  } else if (input.event_date > getTodayDateOnly()) {
    errors.event_date = "Event date cannot be in the future.";
  }

  if (description.length < 5 || description.length > 1000) {
    errors.description = "Description must be between 5 and 1000 characters.";
  }

  return result(errors);
}

export function validateClaimQuestion(question: string): ValidationResult {
  const trimmed = question.trim();
  const errors: Record<string, string> = {};

  if (!trimmed) {
    errors.question = "Verification question is required.";
  } else if (trimmed.length < 5 || trimmed.length > 500) {
    errors.question = "Question must be between 5 and 500 characters.";
  }

  return result(errors);
}

export function validateClaimAnswer(answer: string): ValidationResult {
  const trimmed = answer.trim();
  const errors: Record<string, string> = {};

  if (!trimmed) {
    errors.answer = "Answer is required.";
  } else if (trimmed.length < 1 || trimmed.length > 1000) {
    errors.answer = "Answer must be between 1 and 1000 characters.";
  }

  return result(errors);
}

export function cleanReportInput(input: ReportFormInput): ReportFormInput {
  return {
    ...input,
    item_name: input.item_name.trim().replace(/\s+/g, " "),
    description: input.description.trim(),
  };
}

export function getTodayDateOnly(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
