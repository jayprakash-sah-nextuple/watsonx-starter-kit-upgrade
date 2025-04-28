import { Logger } from '@nestjs/common';
import { Skill } from '../../../decorators';
import { CustomerAppeasementApiService } from '../../oms';
import { CustomerAppeasementConstants } from './constants';
import { FindAppeasementsSkillService } from './find-appeasements-skill.service';
import { getArray, isVoid } from '../../common/functions';

@Skill({
  skillId: 'recommend-appeasement-skill',
  slots: [],
})
export class RecommendAppeasementSkillService extends FindAppeasementsSkillService {
  protected readonly logger: Logger = new Logger(RecommendAppeasementSkillService.name);

  private static readonly MAX_PREVIOUS_APPEASEMENTS = 2;

  constructor(appeasementApiSvc: CustomerAppeasementApiService) {
    super(appeasementApiSvc);
  }

  protected async postOnSlotStateChange(): Promise<void> {
    const appeasementDataProcessed = this.provideAppeasementRecommendation();
    if (!appeasementDataProcessed) {
      await super.postOnSlotStateChange();
      this.provideAppeasementRecommendation();
    }
  }

  private provideAppeasementRecommendation() {
    console.log("Calling provideAppeasementRecommendation");
    let previousAppeasements = this.getLocalVariable(CustomerAppeasementConstants.LOCAL_VARIABLE_PREVIOUS_APPEASEMENTS);
    if (!isVoid(previousAppeasements)) {
      previousAppeasements = getArray(previousAppeasements);
      const recommendation =
        previousAppeasements.length < RecommendAppeasementSkillService.MAX_PREVIOUS_APPEASEMENTS ? 'approve' : 'reject';
      this.addTextResponse(this.getStringLiteral(`actionResponses.${recommendation}`));
      this.markSkillComplete({ recommendation });
      return true;
    } else if (this.getSessionVariable(CustomerAppeasementConstants.LOCALE_VARIABLE_FIND_APPEASEMENTS_FAILED)) {
      return true;
    }
    return false;
  }
}
