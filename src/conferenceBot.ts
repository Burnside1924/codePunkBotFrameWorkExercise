import { ActivityHandler, ConversationState, TurnContext } from "botbuilder"
import { LuisRecognizer, QnAMaker } from "botbuilder-ai";
import { DialogSet } from "botbuilder-dialogs";
import { CardsService } from "./services/cardsService";
import { RetrieveDataService } from "./services/retrieveDataService";
import { SpeakerSession } from "./types/speakerSession";

export class ConferenceBot extends ActivityHandler {
    constructor(
        private luis: LuisRecognizer,
        private qnaMaker: QnAMaker,
        private retrieveDataService: RetrieveDataService,
        private cardsService: CardsService,
        private conversationState: ConversationState,
        private dialogSet: DialogSet
    ) {
        super();

        this.onMembersAdded(async (context, next) => {
            const activity = context.activity;

            for (const member of activity.membersAdded) {
                member.id !== activity.recipient.id && await context.sendActivity('Hello to the Conference Bot!');
            }

            await next();
        });

        this.onMessage(async (context, next) => {
            const qnaMakerResults = await this.qnaMaker.getAnswers(context);

            if (qnaMakerResults.length) {
                context.sendActivity(qnaMakerResults[0].answer);
            }
            else {
                this.performLuisRecognize(context);
            }

            await next();
        });

        this.onUnrecognizedActivityType(async (context, next) => {
            await this.luis.recognize(context).then(r => {
                context.sendActivity(`Intent, ${LuisRecognizer.topIntent(r)}, found`)
            });

            await next();
        });
    }

    async performLuisRecognize(turnContext: TurnContext): Promise<void> {
        await this.luis.recognize(turnContext).then(response => {
            const topIntent = LuisRecognizer.topIntent(response);
            const speakerSessions: SpeakerSession[] = this.retrieveDataService.getSpeakerSessions();

            switch (topIntent) {
                case "Speaker":
                    //
                    break;
                case "Location":
                    //
                    break;
                case "Time":
                    //
                    break;
                case "Topic":
                    if (speakerSessions.length > 1) {
                        turnContext.sendActivity(this.cardsService.createCarousel(speakerSessions, topIntent));
                        break;
                    }
                    else if (speakerSessions.length) {
                        turnContext.sendActivity(
                            {
                                attachments: [this.cardsService.createHeroCard(speakerSessions[0], topIntent)]
                            }
                        );
                        break;
                    }

                    turnContext.sendActivity(`No sessions for a topic on ${topIntent}`)
                    break;
                default:
                    turnContext.sendActivity(`No action available for intent ${topIntent}`)
                    break;
            }
        });
    }
}