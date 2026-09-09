import { randomBytes } from "crypto";

// design.md decision #19: cryptographically random, not a guessable/sequential
// id — this token gates access to a proposal's client-sensitive pricing/scope.
export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}
