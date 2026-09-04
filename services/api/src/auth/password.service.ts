import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/**
 * Staff/admin password hashing. Argon2id (OWASP's recommended default) —
 * memory-hard, resistant to GPU/ASIC cracking, no configured secret pepper
 * needed since the hash itself is salted per-call by argon2.
 */
@Injectable()
export class PasswordService {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, { type: argon2.argon2id });
  }

  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }
}
