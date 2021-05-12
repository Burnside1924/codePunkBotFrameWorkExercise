import { ActivityHandler, ConversationState, TurnContext } from "botbuilder"
import { LuisRecognizer, QnAMaker } from "botbuilder-ai";
import { ChoicePrompt, DialogSet, PromptOptions, WaterfallDialog, WaterfallStepContext } from "botbuilder-dialogs";
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
        this.addDialogs();

        this.onMembersAdded(async (context, next) => {
            const activity = context.activity;

            for (const member of activity.membersAdded) {
                member.id !== activity.recipient.id && await context.sendActivity('Hello to the Conference Bot!');
            }

            await next();
        });

        this.onDialog(async (context, next) => {
            const dialogContext = await this.dialogSet.createContext(context);

            await dialogContext.continueDialog();

            const text = context.activity.text;

            text && text === "help" && await dialogContext.beginDialog("help");
            await this.conversationState.saveChanges(context);
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

            await this.conversationState.saveChanges(context);
            await next();
        });

        this.onUnrecognizedActivityType(async (context, next) => {
            await this.luis.recognize(context).then(r => {
                context.sendActivity(`Intent, ${LuisRecognizer.topIntent(r)}, found`)
            });

            await this.conversationState.saveChanges(context);
            await next();
        });
    }

    addDialogs(): void {
        this.dialogSet.add(
            new WaterfallDialog(
                "help",
                [
                    async (step: WaterfallStepContext) => {
                        const choices = [
                            "I want to know about a topic",
                            "I want to know about a speaker",
                            "I want to know about a venue"
                        ];
                        const options: PromptOptions = {
                            prompt: "What would you like to know?",
                            choices: choices
                        }

                        return await step.prompt("choicePrompt", options);
                    },
                    async (step: WaterfallStepContext) => {
                        switch (step.result.index) {
                            case 0:
                                await step.context.sendActivity(
                                    `You can ask:
                                    *_Is there a chat bot presentation?_
                                    *_Is there a presentation on Xamarin?_
                                    *_Is there a presentation on Microsoft Azure?_`
                                );
                                break;
                            case 1:
                                await step.context.sendActivity(
                                    `You can ask:
                                    *_Is Tim Spencer speaking?_
                                    *_Is Michael Szul speaking?_
                                    *_Who is doing a presentation on conversational chat bots?_`
                                );
                                break;
                            case 2:
                                await step.context.sendActivity(
                                    `You can ask:
                                    *_Where is the talk on chat bots?_
                                    *_Where is the venue for Szul?_
                                    *_Where is Tim Spencer speaking?_`
                                );
                                break;
                            default:
                                break;
                        }

                        return await step.endDialog()
                    }
                ]
            )
        );

        this.dialogSet.add(new ChoicePrompt("choicePrompt"));

        this.dialogSet.add(
            new WaterfallDialog(
                "time",
                [
                    async (step: WaterfallStepContext) => {
                        await step.context.sendActivities(this.retrieveDataService.getTimes(step.activeDialog.state.options));
                        return await step.endDialog();
                    }
                ]
            )
        );
    }

    async performLuisRecognize(turnContext: TurnContext): Promise<void> {
        const dialogContext = await this.dialogSet.createContext(turnContext);

        await dialogContext.continueDialog();
        await this.luis.recognize(turnContext).then(response => {
            const speakerSessions: SpeakerSession[] = this.retrieveDataService.getSpeakerSessions();
            const topIntent = LuisRecognizer.topIntent(response).toLocaleLowerCase();
            const entity = response.entities[0].toLocaleLowerCase();

            switch (topIntent) {
                case "speaker":
                    //
                    break;
                case "location":
                    //
                    break;
                case "time":
                    dialogContext.beginDialog("time", speakerSessions);
                    break;
                case "topic":
                    const topicSessions = speakerSessions.filter(s =>
                        s.keywords.includes(entity) || s.title.includes(entity) || s.description.includes(entity)
                    );

                    if (topicSessions.length > 1) {
                        turnContext.sendActivity(this.cardsService.createCarousel(speakerSessions, topIntent));
                        break;
                    }
                    else if (topicSessions.length) {
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