import { Body, Controller, Post } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

@Controller('api/v1/waitlist')
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  /** Issue #690 — POST /api/v1/waitlist/join */
  @Post('join')
  join(
    @Body()
    body: {
      email: string;
      username?: string;
      businessName?: string;
      country?: string;
      referralCode?: string;
    },
  ) {
    return this.waitlist.join(body);
  }
}
