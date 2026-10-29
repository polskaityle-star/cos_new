import test from "node:test";
import assert from "node:assert/strict";
import { isSafeStoredFile } from "../src/lib/files.ts";

test("isSafeStoredFile: akceptuje bezpieczne pliki graficzne", () => {
  assert.equal(
    isSafeStoredFile(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "image"
    ),
    true
  );
  assert.equal(isSafeStoredFile("data:image/jpeg;base64,/9j/4AAQSkZJRg==", "image"), true);
  assert.equal(isSafeStoredFile("data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "image"), true);
  assert.equal(isSafeStoredFile("https://example.com/image.png", "image"), true);
  assert.equal(isSafeStoredFile("https://cdn.discordapp.com/attachments/123/456/photo.jpg", "image"), true);
  assert.equal(isSafeStoredFile("/uploads/reports/a.png", "image"), true);
  assert.equal(isSafeStoredFile("/uploads/reports/report_2026_10_29.webp", "image"), true);
});

test("isSafeStoredFile: akceptuje bezpieczne pliki tekstowe", () => {
  assert.equal(isSafeStoredFile("data:text/plain;base64,SGVsbG8gd29ybGQ=", "text"), true);
  assert.equal(isSafeStoredFile("/uploads/reports/summary.txt", "text"), true);
  assert.equal(isSafeStoredFile("https://example.com/log.txt", "text"), true);
});

test("isSafeStoredFile: odrzuca path traversal", () => {
  assert.equal(isSafeStoredFile("/uploads/reports/../.env", "image"), false);
  assert.equal(isSafeStoredFile("/uploads/../x", "image"), false);
  assert.equal(isSafeStoredFile("/uploads/reports/../../etc/passwd", "text"), false);
  assert.equal(isSafeStoredFile("..\\..\\.env", "image"), false);
});

test("isSafeStoredFile: odrzuca niebezpieczne schematy i formaty XSS", () => {
  assert.equal(isSafeStoredFile("javascript:alert(1)", "image"), false);
  assert.equal(isSafeStoredFile("data:image/svg+xml;base64,AAAA", "image"), false);
  assert.equal(isSafeStoredFile("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "text"), false);
  assert.equal(isSafeStoredFile("http://insecure.com/photo.png", "image"), false);
  assert.equal(isSafeStoredFile("", "image"), false);
  assert.equal(isSafeStoredFile(null, "image"), false);
  assert.equal(isSafeStoredFile(undefined, "image"), false);
});
