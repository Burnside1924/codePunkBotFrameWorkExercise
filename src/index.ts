// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { BotFrameworkAdapter, ConversationState, MemoryStorage } from 'botbuilder';
import { LuisRecognizer, QnAMaker } from 'botbuilder-ai';
import { DialogSet } from 'botbuilder-dialogs';
import { config } from 'dotenv';
import * as path from 'path';

// Note: Ensure you have a .env file and include LuisAppId, LuisAPIKey and LuisAPIHostName.
const ENV_FILE = path.join(__dirname, '..', '.env');
config({ path: ENV_FILE });

import * as restify from 'restify';
import { ConferenceBot } from './conferenceBot';
import { CardsService } from './services/cardsService';
import { RetrieveDataService } from './services/retrieveDataService';

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
const onTurnErrorHandler = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error(`\n [onTurnError] unhandled error: ${error}`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('The bot encountered an error or bug.');
    await context.sendActivity('To continue to run this bot, please fix the bot source code.');
};

// Set the onTurnError for the singleton BotFrameworkAdapter.
adapter.onTurnError = onTurnErrorHandler;

const { LuisAppId, LuisAPIKey, LuisAPIHostName, QnaMakerHost, QnaMakerEndpointKey, QnaMakerKnowledgeBaseId } = process.env;
const luis: LuisRecognizer = new LuisRecognizer({
    applicationId: LuisAppId,
    endpointKey: LuisAPIKey,
    endpoint: LuisAPIHostName
});
const qnaMaker: QnAMaker = new QnAMaker({
    knowledgeBaseId: QnaMakerKnowledgeBaseId,
    host: QnaMakerHost,
    endpointKey: QnaMakerEndpointKey
});
const conversationState: ConversationState = new ConversationState(new MemoryStorage());
const dialogSet = new DialogSet(conversationState.createProperty("dialogState"));

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log('\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator');
    console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

const bot = new ConferenceBot(
    luis,
    qnaMaker,
    new RetrieveDataService(),
    new CardsService(),
    conversationState,
    dialogSet
);

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {
    // Route received a request to adapter for processing
    adapter.processActivity(req, res, async (turnContext) => {
        // route to bot activity handler.
        await bot.run(turnContext);
    });
});

// Listen for Upgrade requests for Streaming.
server.on('upgrade', (req, socket, head) => {
    // Create an adapter scoped to this WebSocket connection to allow storing session data.
    const streamingAdapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword
    });
    // Set onTurnError for the BotFrameworkAdapter created for each connection.
    streamingAdapter.onTurnError = onTurnErrorHandler;

    streamingAdapter.useWebSocket(req, socket, head, async (context) => {
        // After connecting via WebSocket, run this logic for every request sent over
        // the WebSocket connection.
        await bot.run(context);
    });
});
