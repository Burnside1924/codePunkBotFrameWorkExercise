import { Activity, Attachment, CardFactory, MessageFactory } from "botbuilder";
import { s } from "metronical.proto";
import { CardFactoryHeroCardTitles } from "../types/cardFactoryHeroCardTitles";
import { SpeakerImage } from "../types/speakerImage";
import { SpeakerSession } from "../types/speakerSession";

export class CardsService {

    createCarousel(speakerSessions: SpeakerSession[], intent: string): Partial<Activity> {
        return MessageFactory.carousel(speakerSessions.map(s => this.createHeroCard(s, intent)));
    }

    createHeroCard(speakerSession: SpeakerSession, intent: string): Attachment {
        const titling: CardFactoryHeroCardTitles = this.findHeroCardTitling(speakerSession, intent);

        return CardFactory.heroCard(
            titling.title,
            CardFactory.images(this.findImagesLinks(speakerSession)),
            CardFactory.actions(
                [
                    {
                        type: "openUrl",
                        title: "Read more...",
                        value: speakerSession.link
                    }
                ]
            ),
            {
               subtitle: titling.subtitle,
               text: titling.description
            }
        )
    }

    findHeroCardTitling(speakerSession: SpeakerSession, intent: string): CardFactoryHeroCardTitles {
        const description: string = s(speakerSession.description)
            .stripHtml()
            .truncateWords(30)
            .toString();

        switch(intent) {
            case "Topic":
                return {
                    description: description,
                    title: speakerSession.title,
                    subtitle: speakerSession.speaker
                }
            case "Location":
                return {
                    description: speakerSession.description,
                    title: speakerSession.location,
                    subtitle: `A presentation on ${speakerSession.title} by ${speakerSession.speaker}`
                }
            case "Speaker":
                return {
                    description: description,
                    title: speakerSession.speaker,
                    subtitle: `A presentation on ${speakerSession.title} at ${speakerSession.location}`
                }
            default:
                throw new Error(`No data for intent ${intent}`);
        }
    }

    findImagesLinks(speakerSession: SpeakerSession): string[] {
        const images: SpeakerImage[] = speakerSession.images;

        return images ? images.map(i => i.link) : [];
    }
}