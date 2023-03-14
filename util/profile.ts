import { Profile } from "../model/authen";
import { CustomRequest } from "../router/middleware/middleware";
import { Request } from "express";

export const getProfile = (req: Request): Profile => (req as CustomRequest).profile