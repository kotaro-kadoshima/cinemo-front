import { NextResponse } from "next/server";
import { GoogleGenAI, AuthToken } from "@google/genai";

export async function POST() {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return NextResponse.json(
        {
          error: "Server configuration error",
          detail: "API key not configured",
        },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI({ apiKey: API_KEY });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30分後
    const newSessionExpireTime = new Date(
      Date.now() + 1 * 60 * 1000
    ).toISOString(); // 1分後

    const token: AuthToken = await client.authTokens.create({
      config: {
        uses: 1, // デフォルト値
        expireTime: expireTime, // デフォルトは30分
        newSessionExpireTime: newSessionExpireTime, // デフォルトは1分後
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    return NextResponse.json({
      token: token.name,
    });
  } catch (error) {
    console.error("Error creating auth token:", error);
    return NextResponse.json(
      {
        error: "internal server error",
        detail: "Failed to create auth token",
      },
      { status: 500 }
    );
  }
}
