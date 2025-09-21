
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


        let model = await createChatModel();
        const openaiClient = (model as any)?.client;
        const completions = openaiClient?.chat?.completions;
        if (completions && typeof completions.create === 'function') {
            const originalCreate = completions.create.bind(completions);
            completions.create = async (...args: unknown[]) => {
                const [request] = args as [{ [key: string]: unknown }?];
                console.debug('[AgentServer] openai.completions.create request', request);
                const result = await originalCreate(...args);
                console.debug('[AgentServer] openai.completions.create response id', (result as any)?.id ?? null);
                return result;
            };
        }
        let tools: any[] = [];
        for (const agentUrl of agentCardUrls) {
            const agentTools: any = await a2a2langchain({
                cardUrl: agentUrl,
            });
            console.debug('[AgentServer] tool wrapper', {
                cardUrl: agentUrl,
                wrapperType: Array.isArray(agentTools) ? 'array' : typeof agentTools,
                toolTypes: Array.isArray(agentTools)
                    ? agentTools.map((t: any) => t?.constructor?.name ?? typeof t)
                    : agentTools?.tool?.constructor?.name,
            });
            if (Array.isArray(agentTools)) {
                tools = tools.concat(agentTools);
            } else if (agentTools?.tool) {
                tools.push(agentTools.tool);
            }
        }
        const boundTools = tools.filter(Boolean);
        console.debug('[AgentServer] binding tools', boundTools.map((t: any) => t?.constructor?.name ?? typeof t));

        model = model.bindTools(boundTools);

        const toolNode = new ToolNode(boundTools);
        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("agent", async function callModel(state: typeof MessagesAnnotation.State) {
                console.debug('[AgentServer] model.invoke input', state.messages);
                const response = await model.invoke(state.messages);
                console.debug('[AgentServer] model.invoke output', response);

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
