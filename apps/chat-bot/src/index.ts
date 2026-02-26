/**
 * @agentio/chat-bot — Entry point
 *
 * Starts the Bun HTTP server with AgentLoop-backed chat API.
 */

import { startServer } from "./server.js";

const port = parseInt(process.env.PORT ?? "3001", 10);
startServer(port);
