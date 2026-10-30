import test from "node:test";
import assert from "node:assert/strict";
import {
  isSafeStoredFile,
  isSafeImageUrl,
  isTrustedImageHost,
  formatScreenshotForDiscord,
} from "../src/lib/files.ts";

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

test("isSafeImageUrl: akceptuje tylko bezpieczne obrazy", () => {
  assert.equal(isSafeImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), true);
  assert.equal(isSafeImageUrl("/uploads/defects/photo1.jpg"), true);
  assert.equal(isSafeImageUrl("https://cdn.example.com/photo.webp"), true);
  assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
  assert.equal(isSafeImageUrl("/uploads/../.env"), false);
  assert.equal(isSafeImageUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false);
  assert.equal(isSafeImageUrl(null), false);
  assert.equal(isSafeImageUrl(""), false);
});

test("isTrustedImageHost: akceptuje tylko dozwolone hosty Discorda bez spacji i nawiasów", () => {
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/attachments/123/456/photo.png"), true);
  assert.equal(isTrustedImageHost("https://media.discordapp.net/attachments/123/456/screen.jpg"), true);

  // Odrzucenie obcych domen
  assert.equal(isTrustedImageHost("https://evil.com/image.png"), false);
  assert.equal(isTrustedImageHost("https://discordapp.com.evil.com/image.png"), false);
  assert.equal(isTrustedImageHost("https://google.com/photo.jpg"), false);

  // Odrzucenie protokołu http
  assert.equal(isTrustedImageHost("http://cdn.discordapp.com/image.png"), false);

  // Odrzucenie spacji i nawiasów niszczących formatowanie markdown
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/attachments/test (1).png"), false);
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/attachments/test photo.png"), false);

  // Odrzucenie lokalnych plików i pustych wartości
  assert.equal(isTrustedImageHost("/uploads/reports/file.png"), false);
  assert.equal(isTrustedImageHost(""), false);
  assert.equal(isTrustedImageHost(null), false);
  assert.equal(isTrustedImageHost(undefined), false);
});

test("formatScreenshotForDiscord: formatuje linki z hostname lub jako tekst", () => {
  assert.equal(
    formatScreenshotForDiscord("https://cdn.discordapp.com/attachments/123/screen.png", "Screen wyjazdu"),
    "[Screen wyjazdu (cdn.discordapp.com)](https://cdn.discordapp.com/attachments/123/screen.png)"
  );
  assert.equal(
    formatScreenshotForDiscord("https://media.discordapp.net/attachments/123/screen.jpg", "Screen zjazdu"),
    "[Screen zjazdu (media.discordapp.net)](https://media.discordapp.net/attachments/123/screen.jpg)"
  );
  assert.equal(
    formatScreenshotForDiscord("/uploads/reports/file.png", "Screen wyjazdu"),
    "Screen wyjazdu: link niedostępny w bocie, sprawdź w panelu WWW"
  );
  assert.equal(
    formatScreenshotForDiscord("https://example.com/screen.png", "Screen zjazdu"),
    "Screen zjazdu: link niedostępny w bocie, sprawdź w panelu WWW"
  );
  assert.equal(formatScreenshotForDiscord(null, "Screen wyjazdu"), null);
  assert.equal(formatScreenshotForDiscord("", "Screen wyjazdu"), null);
});
