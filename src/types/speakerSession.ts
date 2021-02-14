import { SpeakerImage } from "./speakerImage";

export interface SpeakerSession {
    date: string,
    startTime: string,
    endTime: string,
    title: string,
    description: string,
    speaker: string,
    location: string,
    keywords: string,
    type: string,
    link: string,
    images?: SpeakerImage[]
}