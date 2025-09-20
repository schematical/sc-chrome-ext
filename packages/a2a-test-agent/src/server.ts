import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AgentCard, Message, Task, TaskArtifactUpdateEvent, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
  DefaultRequestHandler,
  InMemoryTaskStore,
} from '@a2a-js/sdk/server';
import { A2AExpressApp } from '@a2a-js/sdk/server/express';

const port = Number(process.env.PORT ?? 8002);

const testAgentCard: AgentCard = {
  protocolVersion: '0.3.0',
  name: 'Test Catalog Agent',
  description: 'A simple A2A agent used for local integration tests.',
  url: `http://localhost:${port}/`,
  version: '0.1.0',
  provider: {
    organization: 'Schematical Testing',
    url: 'https://example.com',
  },
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id: 'test_task',
      name: 'Test Task',
      description: 'Returns a canned task result for verification.',
      tags: ['test'],
    },
    {
      id: 'get_random_fruit',
      name: 'Random Fruit',
      description: 'Responds with a random fruit for testing multi-skill routing.',
      tags: ['test', 'fruit'],
    },
  ],
};

const randomFruits = ['apple', 'banana', 'orange', 'mango', 'kiwi', 'grape', 'pineapple', 'pear'];

class TestTaskExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId } = requestContext;

    console.log('[TestAgent] Request received', {
      taskId,
      contextId,
      metadata: (requestContext as unknown as { metadata?: Record<string, unknown> }).metadata,
    });

    const initialTask: Task = {
      kind: 'task',
      id: taskId,
      contextId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString(),
      },
      history: [],
    };
    eventBus.publish(initialTask);
    eventBus.on('event', (event) => {
      console.log('[TestAgent] Event emitted', event);
    });
    eventBus.on('finished', () => {
      console.log('[TestAgent] Execution finished', { taskId, contextId });
    });

    const metadata = (requestContext as unknown as { metadata?: Record<string, unknown> }).metadata ?? {};
    const requestedSkill = typeof metadata.skillId === 'string' ? metadata.skillId : undefined;
    const fruit = randomFruits[Math.floor(Math.random() * randomFruits.length)];

    const responseText = requestedSkill === 'get_random_fruit'
      ? `Here is a random fruit for you: ${fruit}.`
      : 'Test agent response payload.';

    const responseMessage: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [
        {
          kind: 'text',
          text: responseText,
        },
      ],
      contextId,
    };

    const artifactUpdate: TaskArtifactUpdateEvent = {
      kind: 'artifact-update',
      taskId,
      contextId,
      artifact: {
        artifactId: 'report-1',
        name: 'analysis_report.txt',
        parts: [
          {
            kind: 'text',
            text: requestedSkill === 'get_random_fruit'
              ? `Random fruit served: ${fruit}.`
              : `This is the analysis for task ${taskId}.`,
          },
        ],
      },
    };

    eventBus.publish(artifactUpdate);
    eventBus.publish(responseMessage);

    const finalUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId,
      contextId,
      status: {
        state: 'completed',
        timestamp: new Date().toISOString(),
      },
      final: true,
    };

    eventBus.publish(finalUpdate);
    eventBus.finished();

    console.log('[TestAgent] Response sent');
  }

  cancelTask = async (): Promise<void> => Promise.resolve();
}

function createExpressApp(): express.Express {
  const executor = new TestTaskExecutor();
  const handler = new DefaultRequestHandler(testAgentCard, new InMemoryTaskStore(), executor);
  const builder = new A2AExpressApp(handler);
  const app = express();
  builder.setupRoutes(app as any);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createExpressApp();
  app.listen(port, () => {
    console.log(`[A2A-Test-Agent] listening on http://localhost:${port}`);
  });
}

export { createExpressApp, testAgentCard };
