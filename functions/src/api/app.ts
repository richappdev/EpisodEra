import cors from "cors";
import express, {ErrorRequestHandler} from "express";
import {HttpError} from "../lib/httpError";
import {optionalAuth} from "../middleware/auth";
import {mediaRouter} from "./mediaRoutes";
import {watchlistRouter} from "./watchlistRoutes";

export const app = express();

app.use(cors({origin: true}));
app.use(express.json());
app.use(optionalAuth);

app.get("/health", (_req, res) => {
  res.json({ok: true});
});

app.use("/", mediaRouter);
app.use("/", watchlistRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({error: {code: error.code, message: error.message}});
    return;
  }

  res.status(500).json({error: {code: "internal", message: "Internal server error."}});
};

app.use(errorHandler);
