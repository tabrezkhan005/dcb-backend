import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { config } from "../../config/env";
import { redisHelpers } from "../../config/redis";
import type { RequestUser } from "../../types/domain";
import { AppError } from "../../utils/errors";

const REFRESH_TTL_SEC = 60 * 60 * 24 * 7;
const BCRYPT_ROUNDS = 12;

function fingerprintToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function login(
  phone: string,
  password: string,
  deviceId: string,
  fastify: FastifyInstance,
) {
  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (user === null || user.isActive === false) {
      throw AppError.unauthorized("Invalid credentials");
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      throw AppError.unauthorized("Invalid credentials");
    }

    let effectiveDeviceId = user.deviceId;
    if (user.deviceId === null) {
      await prisma.user.update({
        where: { id: user.id },
        data: { deviceId },
      });
      effectiveDeviceId = deviceId;
    } else if (user.deviceId !== deviceId) {
      throw AppError.unauthorized(
        "Device not authorized. Please use your registered device.",
      );
    }

    const payload: RequestUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      districtId: user.districtId,
      deviceId: effectiveDeviceId ?? deviceId,
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = jwt.sign(
      { id: user.id, typ: "refresh" },
      config.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TTL_SEC },
    );

    await redisHelpers.setex(
      `dcb:refresh:${user.id}`,
      REFRESH_TTL_SEC,
      refreshToken,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        districtId: user.districtId,
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Login failed",
      500,
    );
  }
}

interface RefreshJwtBody {
  id?: string;
  typ?: string;
}

export async function refresh(
  refreshToken: string,
  fastify: FastifyInstance,
) {
  try {
    const decoded = jwt.verify(
      refreshToken,
      config.JWT_REFRESH_SECRET,
    ) as RefreshJwtBody;
    if (decoded.typ !== "refresh" || typeof decoded.id !== "string") {
      throw AppError.unauthorized("Invalid refresh token");
    }

    const stored = await redisHelpers.get(`dcb:refresh:${decoded.id}`);
    if (stored === null || stored !== refreshToken) {
      throw AppError.unauthorized("Refresh token expired or rotated");
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (user === null || user.isActive === false) {
      throw AppError.unauthorized("User not available");
    }

    if (user.deviceId === null) {
      throw AppError.unauthorized("Device not registered");
    }

    await redisHelpers.del(`dcb:refresh:${user.id}`);

    const payload: RequestUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      districtId: user.districtId,
      deviceId: user.deviceId,
    };

    const accessToken = fastify.jwt.sign(payload, { expiresIn: "15m" });
    const newRefresh = jwt.sign(
      { id: user.id, typ: "refresh" },
      config.JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TTL_SEC },
    );

    await redisHelpers.setex(
      `dcb:refresh:${user.id}`,
      REFRESH_TTL_SEC,
      newRefresh,
    );

    return { accessToken, refreshToken: newRefresh };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized("Invalid refresh token");
    }
    throw new AppError(
      err instanceof Error ? err.message : "Refresh failed",
      500,
    );
  }
}

export async function logout(
  userId: string,
  accessToken: string,
  fastify: FastifyInstance,
) {
  try {
    const payload = fastify.jwt.verify(accessToken) as RequestUser;
    if (payload.id !== userId) {
      throw AppError.unauthorized("Invalid token");
    }
    const decoded = jwt.decode(accessToken) as { exp?: number } | null;
    const exp = decoded?.exp;
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl =
      exp !== undefined ? Math.max(exp - nowSec, 1) : 60 * 15;
    const fp = fingerprintToken(accessToken);
    await redisHelpers.setex(`dcb:blacklist:${fp}`, ttl, "1");
    await redisHelpers.del(`dcb:refresh:${userId}`);
    return { ok: true as const };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthorized("Invalid token");
  }
}

export async function savePushToken(userId: string, pushToken: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
    return { ok: true as const };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to save push token",
      500,
    );
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, isActive: true },
    });
    if (user === null || user.isActive === false) {
      throw AppError.unauthorized("User not available");
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      throw AppError.badRequest("Current password is incorrect", "WRONG_PASSWORD");
    }
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
    return { ok: true as const };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      err instanceof Error ? err.message : "Failed to change password",
      500,
    );
  }
}
