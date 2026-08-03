import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$mUIPPhyArAneZPV/p2+pIA$bpN4LGB3u5pA+tVpiGEo0Bb0Z3cKyxAi4K664qefgGU';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    try {
      const valid = await argon2.verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
      return passwordHash !== undefined && valid;
    } catch {
      return false;
    }
  }
}
