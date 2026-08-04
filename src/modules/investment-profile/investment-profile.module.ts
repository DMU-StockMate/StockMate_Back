import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestmentProfileController } from './controllers/investment-profile.controller';
import { InvestmentProfileService } from './services/investment-profile.service';
import { InvestmentProfile } from './entities/investment-profile.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvestmentProfile, User])],
  controllers: [InvestmentProfileController],
  providers: [InvestmentProfileService],
})
export class InvestmentProfileModule {}
