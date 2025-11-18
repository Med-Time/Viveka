import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

  export function extractOptions(question: string): string[] {
  if (!question) return [];

  // Normalized line breaks
  const text = question.replace(/\r/g, "");

  // Try common MCQ patterns
  const regexPatterns = [
    /\([a-d]\)\s*([^(\n]+)/gi,     // (a) Option
    /[a-d]\)\s*([^\n]+)/gi,        // a) Option
    /[A-D]\.\s*([^\n]+)/g,         // A. Option
    /\d+\.\s*([^\n]+)/g,           // 1. Option
    /-\s*([^\n]+)/g,               // - Option
  ];

  let match;
  let results: string[] = [];

  for (const pattern of regexPatterns) {
    const extracted: string[] = [];
    while ((match = pattern.exec(text))) {
      const option = match[1]?.trim();
      if (option) extracted.push(option);
    }

    if (extracted.length >= 2) {
      results = extracted;
      break;
    }
  }

  // If nothing matched, fallback: split lines after the question
  if (results.length === 0) {
    const lines = text.split("\n").map(l => l.trim());
    results = lines.filter(l =>
      l.match(/^[-•*]\s/) ||              // bullet points
      l.match(/^[A-D]\./) ||              // A.
      l.match(/^\d+\./)                   // 1.
    ).map(l => l.replace(/^[-•*]\s/, "").trim());
  }

  return results;
}
