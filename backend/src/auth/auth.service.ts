import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Merchant } from '../merchant/merchant.entity';
import { RefreshToken } from './refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Merchant)
    private readonly merchants: Repository<Merchant>,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
  ) {}

  // Issue #589 — JWT login
  async login(email: string, password: string) {
    const merchant = await this.merchants.findOne({ where: { email } });
    if (!merchant || !(await bcrypt.compare(password, merchant.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = this.signAccess(merchant);
    const refreshToken = await this.issueRefresh(merchant.id);
    return { accessToken, refreshToken, merchant: this.sanitize(merchant) };
  }

  // Issue #590 — refresh token rotation
  async refresh(rawToken: string) {
    const hash = this.hashToken(rawToken);
    const record = await this.tokens.findOne({ where: { tokenHash: hash }, relations: ['merchant'] });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.tokens.remove(record); // rotation: invalidate old token
    const accessToken = this.signAccess(record.merchant);
    const refreshToken = await this.issueRefresh(record.merchant.id);
    return { accessToken, refreshToken };
  }

  // Issue #592 — verify email
  async verifyEmail(token: string) {
    const merchant = await this.merchants.findOne({ where: { emailVerifyToken: token } });
    if (!merchant || !merchant.emailVerifyExpiry || merchant.emailVerifyExpiry < new Date()) {
      throw new UnauthorizedException('Verification link is invalid or expired');
    }
    merchant.emailVerified = true;
    merchant.emailVerifyToken = null;
    merchant.emailVerifyExpiry = null;
    await this.merchants.save(merchant);
    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const merchant = await this.merchants.findOne({ where: { email } });
    if (!merchant || merchant.emailVerified) return; // silent no-op for unverified vs already verified
    await this.setVerifyToken(merchant);
    // caller (controller/mailer) sends the email
    return merchant;
  }

  // helpers
  async setVerifyToken(merchant: Merchant) {
    merchant.emailVerifyToken = crypto.randomBytes(32).toString('hex');
    merchant.emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.merchants.save(merchant);
  }

  private signAccess(merchant: Merchant) {
    return this.jwt.sign(
      { sub: merchant.id, email: merchant.email },
      { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRY ?? '15m' },
    );
  }

  private async issueRefresh(merchantId: string) {
    const raw = crypto.randomBytes(40).toString('hex');
    const record = this.tokens.create({
      tokenHash: this.hashToken(raw),
      merchantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.tokens.save(record);
    return raw;
  }

  private hashToken(raw: string) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private sanitize(m: Merchant) {
    const { passwordHash, emailVerifyToken, ...safe } = m;
    return safe;
  }
}
