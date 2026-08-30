import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Merchant } from './merchant/merchant.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { WaitlistModule } from './waitlist/waitlist.module';
import { WaitlistEntry } from './waitlist/waitlist.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Merchant, RefreshToken, WaitlistEntry],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    AuthModule,
    WaitlistModule,
  ],
})
export class AppModule {}
