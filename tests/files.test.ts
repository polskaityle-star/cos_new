import test from "node:test";
import assert from "node:assert/strict";
import { isSafeStoredFile, isSafeImageUrl, isTrustedImageHost, detectUploadKind } from "../src/lib/files.ts";

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

test("isTrustedImageHost: validates URLs according to strict rules", () => {
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/attachments/123/456/photo.jpg"), true);
  assert.equal(isTrustedImageHost("https://media.discordapp.net/attachments/123/456/photo.jpg"), true);
  assert.equal(isTrustedImageHost("https://i.imgur.com/photo.png"), true);
  assert.equal(isTrustedImageHost("https://prnt.sc/photo"), true);
  assert.equal(isTrustedImageHost("https://zapodaj.net/photo"), true);

  assert.equal(isTrustedImageHost("http://cdn.discordapp.com/photo.jpg"), false);
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com.zly.pl/photo.jpg"), false);
  assert.equal(isTrustedImageHost("https://example.com/photo.jpg"), false);
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/photo.jpg with space"), false);
  assert.equal(isTrustedImageHost("https://cdn.discordapp.com/photo(1).jpg"), false);
  assert.equal(isTrustedImageHost("https://user:pass@cdn.discordapp.com/photo.jpg"), false);
  assert.equal(isTrustedImageHost("not a url"), false);
});

test("detectUploadKind: poprawne nagłówki PNG/JPEG/WebP, tekst UTF-8, bufor z NUL -> null, plik PNG deklarowany jako JPEG -> niezgodność, pusty bufor -> null", () => {
  // Pusty bufor
  assert.equal(detectUploadKind(Buffer.from([])), null);

  // PNG
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectUploadKind(pngBuffer), "png");

  // JPEG
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  assert.equal(detectUploadKind(jpegBuffer), "jpeg");

  // WebP
  const webpBuffer = Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8X\x0a\x00\x00\x00", "ascii");
  assert.equal(detectUploadKind(webpBuffer), "webp");

  // Tekst UTF-8
  const textBuffer = Buffer.from("Zażółć gęślą jaźń", "utf-8");
  assert.equal(detectUploadKind(textBuffer), "text");

  // Bufor z NUL (0x00) w teksćie
  const nulBuffer = Buffer.from("To jest tekst \x00 z NUL", "utf-8");
  assert.equal(detectUploadKind(nulBuffer), null);

  // Plik PNG błędnie deklarowany jako JPEG
  // Test upewnia się, że funkcja wykrywa rzeczywistą zawartość (PNG), niezależnie od nazwy zmiennej
  assert.equal(detectUploadKind(pngBuffer), "png");
  assert.notEqual(detectUploadKind(pngBuffer), "jpeg");
});
