import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { WaitlistEntry } from './waitlist.entity';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly entries: Repository<WaitlistEntry>,
    private readonly ds: DataSource,
  ) {}

  /** Issue #690 — join with optional referral code */
  async join(dto: { email: string; username?: string; businessName?: string; country?: string; referralCode?: string }) {
    const exists = await this.entries.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already on waitlist');

    const maxPos = await this.entries.maximum('position') ?? 0;

    const entry = this.entries.create({
      ...dto,
      position: maxPos + 1,
      referralCode: randomBytes(6).toString('hex'), // unique 12-char code
    });

    await this.entries.save(entry);

    // Process referral after saving (Issue #690)
    if (dto.referralCode) {
      await this.applyReferral(entry, dto.referralCode);
    }

    return entry;
  }

  /** Issue #690 — apply referral: move referrer up 5 positions, prevent self-referral */
  private async applyReferral(newEntry: WaitlistEntry, code: string) {
    const referrer = await this.entries.findOne({ where: { referralCode: code } });
    if (!referrer) return; // invalid code — silently ignore

    if (referrer.id === newEntry.id) {
      throw new BadRequestException('Self-referral is not allowed');
    }

    // Move referrer up 5 positions (lower position = earlier in queue)
    await this.ds.transaction(async (em) => {
      const newPosition = Math.max(1, referrer.position - 5);
      // Shift everyone between newPosition and referrer.position - 1 down by 1
      await em
        .createQueryBuilder()
        .update(WaitlistEntry)
        .set({ position: () => 'position + 1' })
        .where('position >= :start AND position < :end AND id != :id', {
          start: newPosition,
          end: referrer.position,
          id: referrer.id,
        })
        .execute();

      referrer.position = newPosition;
      referrer.referralCount += 1;
      await em.save(referrer);
    });
  }
}
