import { AccessToken } from "@model/authen";
import { CustomRequest } from "@router/middleware/middleware";
import { Request } from "express";

export const getProfile = (req: Request): AccessToken => (req as CustomRequest).profile