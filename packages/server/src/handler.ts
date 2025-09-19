import { configure } from '@codegenie/serverless-express';
import { loadEnv } from './lib/env.js';
import { createApp } from './app.js';

loadEnv();

const app = createApp();

export const handler = configure({ app });
