
import cors from 'cors';
import express, {Request, Response} from 'express';


import {a2a2langchain} from 'langchain-a2a';
import {HumanMessage, AIMessage} from "@langchain/core/messages";
import {createChatModel} from './lib/modelFactory.js';
import type {ChatRequestBody, ChatResponseBody} from './lib/types.js';

import {StateGraph, MessagesAnnotation} from "@langchain/langgraph"
import {ToolNode} from "@langchain/langgraph/prebuilt";

export function createApp(): express.Express {
    const app = express();

    app.use(cors({origin: true}));
    app.use(express.json({limit: '1mb'}));

    app.use((req, res, next) => {
        const started = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - started;
            console.log(
                `[AgentServer] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
            );
        });
        next();
    });

    app.get('/healthz', (_req, res) => {
        res.json({ok: true, status: 'healthy', timestamp: Date.now()});
    });


    app.post('/chat', async (req: Request<unknown, ChatResponseBody, ChatRequestBody>, res: Response<ChatResponseBody>) => {

        const {message, agentCardUrls = []} = req.body ?? {};


        const model = await createChatModel();
        const tools = [];
        for (const agentUrl of agentCardUrls) {
            const tool = await a2a2langchain({
                cardUrl: agentUrl,
            });
            tools.push(tool)
        }
        model.bindTools(tools);
        const toolNode = new ToolNode(tools);
        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("agent", async function callModel(state: typeof MessagesAnnotation.State) {
                const response = await model.invoke(state.messages);

                // We return a list, because this will get added to the existing list
                return {messages: [response]};
            })
            .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
            .addNode("tools", toolNode)
            .addEdge("tools", "agent")
            .addConditionalEdges("agent", function shouldContinue({messages}: typeof MessagesAnnotation.State) {
                const lastMessage = messages[messages.length - 1] as AIMessage;

                // If the LLM makes a tool call, then we route to the "tools" node
                if (lastMessage.tool_calls?.length) {
                    return "tools";
                }
                // Otherwise, we stop (reply to the user) using the special "__end__" node
                return "__end__";
            });

        // Finally, we compile it into a LangChain Runnable.
        const app = workflow.compile();

        // Use the agent
        const finalState = await app.invoke({
            messages: [new HumanMessage(message)],
        });
        res.json(finalState.messages as any);

    });

    return app;
}
