import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleChatMessage } from "./chat/chatService.js";
import { createDefaultRouteRepository } from "./db/pool.js";
import { createGoogleDistanceService } from "./distance.js";

const port = process.env.PORT || 4000;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

function createApp({
  chatHandler,
  routeRepository,
  distanceService
} = {}) {
  const app = express();
  const resolvedRouteRepository =
    routeRepository || (chatHandler ? null : createDefaultRouteRepository());
  const resolvedDistanceService =
    distanceService ||
    (chatHandler || !process.env.GOOGLE_MAPS_API_KEY
      ? null
      : createGoogleDistanceService());
  const resolveChat =
    chatHandler ||
    ((message) =>
      handleChatMessage(message, {
        routeRepository: resolvedRouteRepository,
        distanceService: resolvedDistanceService
      }));

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "routegpt-backend"
    });
  });

  app.post("/chat", async (req, res) => {
    try {
      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
          ok: false,
          error: "Request body must be a JSON object."
        });
      }

      const result = await resolveChat(req.body.message);
      return res.json(result);
    } catch (error) {
      if (/message (must|cannot)/i.test(error.message)) {
        return res.status(400).json({
          ok: false,
          error: error.message
        });
      }

      console.error(error);
      return res.status(500).json({
        ok: false,
        error: "RouteGPT could not process this chat request."
      });
    }
  });

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const app = createApp();

  app.listen(port, () => {
    console.log(`RouteGPT backend listening on http://localhost:${port}`);
  });
}

export { createApp };
