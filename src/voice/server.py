"""VoiceLive WebSocket proxy — bridges browser audio to Azure AI VoiceLive."""

import asyncio
import base64
import json
import logging
import os
import signal
import sys
from pathlib import Path

import websockets
from azure.ai.voicelive.aio import VoiceLiveClient
from azure.identity.aio import DefaultAzureCredential
from dotenv import load_dotenv

# Load .env from project root (two levels up from src/voice/)
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("voicelive-proxy")

PORT = int(os.getenv("VOICELIVE_PORT", "5002"))

ENDPOINT = os.getenv(
    "AZURE_VOICELIVE_ENDPOINT",
    (os.getenv("AZURE_OPENAI_ENDPOINT", "") + "/voicelive").lstrip("/"),
)
MODEL = os.getenv("AZURE_VOICELIVE_MODEL", "gpt-4o")
VOICE = os.getenv("AZURE_VOICELIVE_VOICE", "de-DE-AmalaNeural")

SYSTEM_PROMPT = (
    "Du bist eine warmherzige, geduldige KI-Begleiterin, die Oma dabei hilft, "
    "ihre Lebensgeschichten zu erzählen und zu bewahren.\n\n"
    "Deine Regeln:\n"
    "- Sprich immer auf Deutsch, in einem warmen, respektvollen Ton.\n"
    "- Höre aufmerksam zu und zeige echtes Interesse an jeder Geschichte.\n"
    "- Stelle sanfte Nachfragen, um mehr Details zu erfahren "
    "(Wer? Wo? Wann? Wie hat sich das angefühlt?).\n"
    "- Unterbreche niemals — lass Oma in ihrem eigenen Tempo erzählen.\n"
    "- Fasse gelegentlich zusammen, was du gehört hast, um zu zeigen, dass du zuhörst.\n"
    "- Wenn Oma abschweift, bringe sie sanft zum Thema zurück.\n"
    "- Sei komfortabel mit Stille — nicht jede Pause braucht eine Antwort.\n"
    "- Halte deine Antworten kurz und herzlich (2-4 Sätze).\n"
    "- Frage nach verschiedenen Lebensjahrzehnten: Kindheit, Jugend, Erwachsenenalter.\n"
    "- Beziehe dich auf frühere Geschichten, wenn Oma etwas Verwandtes erzählt."
)


async def _send_json(ws, obj: dict) -> None:
    """Send a JSON message to the browser WebSocket."""
    try:
        await ws.send(json.dumps(obj))
    except websockets.exceptions.ConnectionClosed:
        pass


async def _browser_to_voicelive(browser_ws, vl_client) -> None:
    """Forward audio from browser → VoiceLive."""
    try:
        async for message in browser_ws:
            if isinstance(message, bytes):
                # Raw PCM16 audio from the browser
                await vl_client.send_audio(message)
            else:
                # JSON control message
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "end":
                    logger.info("Client requested session end")
                    return
    except websockets.exceptions.ConnectionClosed:
        logger.info("Browser WebSocket closed (browser→VL)")


async def _voicelive_to_browser(browser_ws, vl_client) -> None:
    """Forward events from VoiceLive → browser."""
    try:
        async for event in vl_client.receive_events():
            event_type = getattr(event, "type", None) or type(event).__name__

            # Audio delta — send base64 encoded PCM
            if event_type in ("audio_delta", "AudioDelta"):
                audio_bytes = getattr(event, "audio", None) or getattr(event, "data", None)
                if audio_bytes:
                    if isinstance(audio_bytes, str):
                        b64 = audio_bytes
                    else:
                        b64 = base64.b64encode(audio_bytes).decode("ascii")
                    await _send_json(browser_ws, {"type": "audio", "data": b64})
                    await _send_json(browser_ws, {"type": "status", "status": "speaking"})

            # Transcript (user or assistant, interim or final)
            elif event_type in (
                "transcript",
                "Transcript",
                "input_transcript",
                "InputTranscript",
                "output_transcript",
                "OutputTranscript",
                "TranscriptionUpdate",
                "transcription_update",
            ):
                role = getattr(event, "role", None)
                if role is None:
                    # Infer role from event type name
                    lower = event_type.lower()
                    role = "user" if "input" in lower else "assistant"
                text = getattr(event, "text", "") or getattr(event, "transcript", "") or ""
                is_final = getattr(event, "is_final", True)
                await _send_json(browser_ws, {
                    "type": "transcript",
                    "role": role,
                    "text": text,
                    "isFinal": is_final,
                })

            # Session lifecycle
            elif event_type in ("session_created", "SessionCreated", "session.created"):
                await _send_json(browser_ws, {"type": "status", "status": "listening"})

            # Thinking / generating
            elif event_type in (
                "response_started",
                "ResponseStarted",
                "response.started",
                "generation_started",
            ):
                await _send_json(browser_ws, {"type": "status", "status": "thinking"})

            # Response done — back to listening
            elif event_type in (
                "response_done",
                "ResponseDone",
                "response.done",
                "audio_done",
                "AudioDone",
                "turn_complete",
                "TurnComplete",
            ):
                await _send_json(browser_ws, {"type": "status", "status": "listening"})

            # Error from VoiceLive
            elif event_type in ("error", "Error"):
                msg = getattr(event, "message", "") or str(event)
                logger.error("VoiceLive error: %s", msg)
                await _send_json(browser_ws, {"type": "error", "message": msg})

    except websockets.exceptions.ConnectionClosed:
        logger.info("Browser WebSocket closed (VL→browser)")
    except Exception as exc:
        logger.exception("Error in voicelive→browser loop")
        await _send_json(browser_ws, {"type": "error", "message": str(exc)})


async def handle_connection(browser_ws, path: str = "/") -> None:
    """Handle a single browser WebSocket connection."""
    logger.info("New connection on %s", path)

    credential = DefaultAzureCredential()
    try:
        async with VoiceLiveClient(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
            system_message=SYSTEM_PROMPT,
            voice=VOICE,
            input_audio_format="pcm16",
            input_audio_sample_rate=24000,
            input_audio_channels=1,
            output_audio_format="pcm16",
            output_audio_sample_rate=24000,
            output_audio_channels=1,
            modalities=["audio", "text"],
        ) as vl_client:
            await _send_json(browser_ws, {"type": "status", "status": "listening"})

            # Run both directions concurrently
            b2v = asyncio.create_task(_browser_to_voicelive(browser_ws, vl_client))
            v2b = asyncio.create_task(_voicelive_to_browser(browser_ws, vl_client))

            done, pending = await asyncio.wait(
                [b2v, v2b], return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            for task in done:
                if task.exception():
                    logger.error("Task error: %s", task.exception())

    except Exception as exc:
        logger.exception("VoiceLive session error")
        await _send_json(browser_ws, {"type": "error", "message": str(exc)})
    finally:
        await credential.close()
        logger.info("Connection closed")


async def main() -> None:
    logger.info("Starting VoiceLive proxy on port %d", PORT)
    logger.info("Endpoint: %s  Model: %s  Voice: %s", ENDPOINT, MODEL, VOICE)

    stop = asyncio.get_event_loop().create_future()

    def _signal_handler() -> None:
        if not stop.done():
            stop.set_result(True)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_event_loop().add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler
            pass

    async with websockets.serve(handle_connection, "0.0.0.0", PORT):
        logger.info("Listening on ws://0.0.0.0:%d/ws", PORT)
        try:
            await stop
        except asyncio.CancelledError:
            pass

    logger.info("Server stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Interrupted — shutting down")
        sys.exit(0)
