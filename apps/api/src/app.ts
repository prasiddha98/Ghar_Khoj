import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.get("/api/", (req, res) => {
  res.json({
    message: "Ghar Khoj API",
    endpoints: [
      { path: "/api/auth/register", methods: ["POST"] },
      { path: "/api/auth/login", methods: ["POST"] },
      { path: "/api/rooms", methods: ["GET", "POST"] },
      { path: "/api/rooms/:id", methods: ["GET", "PATCH", "DELETE"] },
      { path: "/api/rooms/owner/:ownerId", methods: ["GET"] },
      { path: "/api/users/:id", methods: ["GET", "PATCH"] },
      { path: "/api/users", methods: ["POST"] },
      { path: "/api/matches", methods: ["POST"] },
      { path: "/api/matches/tenant/:tenantId", methods: ["GET"] },
      { path: "/api/matches/owner/:ownerId", methods: ["GET"] },
      { path: "/api/matches/:id/respond", methods: ["PATCH"] },
      { path: "/api/interactions", methods: ["POST"] },
      { path: "/api/interactions/room/:roomId", methods: ["GET"] },
      { path: "/api/messages/room/:roomId", methods: ["GET", "POST"] },
      { path: "/api/verification", methods: ["POST"] },
      { path: "/api/verification/send-otp", methods: ["POST"] },
      { path: "/api/verification/verify-otp", methods: ["POST"] },
      { path: "/api/recommendations", methods: ["POST"] },
      { path: "/api/tenant-preferences/:userId", methods: ["GET"] },
      { path: "/api/storage/uploads/request-url", methods: ["POST"] },
      { path: "/api/storage/local-upload/:id", methods: ["PUT"] },
      { path: "/api/storage/public-objects/*", methods: ["GET"] },
      { path: "/api/storage/objects/*", methods: ["GET"] },
      { path: "/api/contracts", methods: ["POST"] },
      { path: "/api/contracts/match/:matchId", methods: ["GET"] },
      { path: "/api/contracts/user/:userId", methods: ["GET"] },
      { path: "/api/contracts/:id/sign", methods: ["PATCH"] },
      { path: "/api/contracts/:id/pay", methods: ["POST"] },
      { path: "/api/contracts/:id/khalti/initiate", methods: ["POST"] },
      { path: "/api/contracts/:id/khalti/verify", methods: ["POST"] },
      { path: "/api/contracts/:id/verify", methods: ["PATCH"] },
      { path: "/api/admin/contracts", methods: ["GET"] },
      { path: "/api/healthz", methods: ["GET"] }
    ]
  });
});

export default app;
