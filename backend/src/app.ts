import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error";
import authRoutes from "./routes/auth.routes";
import quizRoutes from "./routes/quiz.routes";
import conceptRoutes from "./routes/concept.routes";
import dashboardRoutes from "./routes/dashboard.routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
if (env.NODE_ENV !== "test") app.use(morgan("dev"));

app.use("/auth", authRoutes);
app.use("/quiz", quizRoutes);
app.use("/concepts", conceptRoutes);
app.use("/dashboard", dashboardRoutes);

app.use(errorHandler);
