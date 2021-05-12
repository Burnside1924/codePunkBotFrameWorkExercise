import { Activity } from "botbuilder";
import { SpeakerSession } from "../types/speakerSession";

export class RetrieveDataService {
    getSpeakerSessions(): SpeakerSession[] {
        return [];
    }

    getTimes(speakerSessions: SpeakerSession[]): Partial<Activity>[] {
        return speakerSessions.map(s => {
            return {
                type: "message",
                text: `${s.speaker} is speaking about ${s.title} at ${s.startTime} on ${s.date} in the ${s.location}.`
            }
        });
    }
}