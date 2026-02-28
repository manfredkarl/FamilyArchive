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
from azure.ai.voicelive.aio import connect as voicelive_connect
from azure.ai.voicelive.models import (
    AzureStandardVoice,
    InputAudioFormat,
    Modality,
    OutputAudioFormat,
    RequestSession,
    ServerEventType,
    ServerVad,
)
from azure.identity.aio import DefaultAzureCredential
from dotenv import load_dotenv

# Load .env from project root (two levels up from src/voice/)
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("voicelive-proxy")

PORT = int(os.getenv("VOICELIVE_PORT", "5002"))

ENDPOINT = os.getenv("AZURE_VOICELIVE_ENDPOINT", os.getenv("AZURE_OPENAI_ENDPOINT", ""))
MODEL = os.getenv("AZURE_VOICELIVE_MODEL", "gpt-4o")
VOICE_NAME = os.getenv("AZURE_VOICELIVE_VOICE", "de-DE-AmalaNeural")

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
    "- Halte deine Antworten kurz und herzlich (2-4 Sätze).\n"
    "- Frage nach verschiedenen Lebensjahrzehnten: Kindheit, Jugend, Erwachsenenalter.\n"
    "- Beziehe dich auf frühere Geschichten, wenn Oma etwas Verwandtes erzählt."
)


async def _send_json(ws, obj: dict) -> None:
    """Send a JSON message to the browser WebSocket."""
    try:
        # Ensure all values are JSON-serializable (convert bytes to base64)
        sanitized = {}
        for k, v in obj.items():
            if isinstance(v, bytes):
                sanitized[k] = base64.b64encode(v).decode("ascii")
            else:
                sanitized[k] = v
        await ws.send(json.dumps(sanitized))
    except websockets.exceptions.ConnectionClosed:
        pass


async def _browser_to_voicelive(browser_ws, vl_conn) -> None:
    """Forward audio from browser → VoiceLive."""
    try:
        async for message in browser_ws:
            if isinstance(message, bytes):
                audio_b64 = base64.b64encode(message).decode("ascii")
                await vl_conn.input_audio_buffer.append(audio=audio_b64)
            else:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "end":
                    logger.info("Client requested session end")
                    return
    except websockets.exceptions.ConnectionClosed:
        logger.info("Browser WebSocket closed (browser→VL)")


async def _voicelive_to_browser(browser_ws, vl_conn) -> None:
    """Forward events from VoiceLive → browser."""
    try:
        async for event in vl_conn:
            evt_type = event.type if hasattr(event, 'type') else type(event).__name__

            if evt_type == ServerEventType.SESSION_CREATED:
                await _send_json(browser_ws, {"type": "status", "status": "listening"})

            elif evt_type == ServerEventType.RESPONSE_AUDIO_DELTA:
                # delta is already raw PCM16 bytes (SDK decodes base64 for us)
                audio_bytes = event.delta if hasattr(event, 'delta') else None
                if audio_bytes and isinstance(audio_bytes, (bytes, bytearray)):
                    try:
                        await browser_ws.send(audio_bytes)
                    except Exception:
                        pass

            elif evt_type == ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
                text = event.delta if hasattr(event, 'delta') else ""
                if text:
                    await _send_json(browser_ws, {
                        "type": "transcript", "role": "assistant",
                        "text": text, "isFinal": False,
                    })

            elif evt_type == ServerEventType.RESPONSE_AUDIO_TRANSCRIPT_DONE:
                text = event.transcript if hasattr(event, 'transcript') else ""
                if text:
                    await _send_json(browser_ws, {
                        "type": "transcript", "role": "assistant",
                        "text": text, "isFinal": True,
                    })

            elif evt_type == ServerEventType.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
                text = event.transcript if hasattr(event, 'transcript') else ""
                if text:
                    await _send_json(browser_ws, {
                        "type": "transcript", "role": "user",
                        "text": text, "isFinal": True,
                    })

            elif evt_type == ServerEventType.CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_DELTA:
                text = event.delta if hasattr(event, 'delta') else ""
                if text:
                    await _send_json(browser_ws, {
                        "type": "transcript", "role": "user",
                        "text": text, "isFinal": False,
                    })

            elif evt_type == ServerEventType.INPUT_AUDIO_BUFFER_SPEECH_STARTED:
                await _send_json(browser_ws, {"type": "status", "status": "listening"})

            elif evt_type == ServerEventType.RESPONSE_CREATED:
                await _send_json(browser_ws, {"type": "status", "status": "thinking"})

            elif evt_type == ServerEventType.RESPONSE_DONE:
                await _send_json(browser_ws, {"type": "status", "status": "listening"})

            elif evt_type == ServerEventType.ERROR:
                msg = str(event.error) if hasattr(event, 'error') else str(event)
                logger.error("VoiceLive error: %s", msg)
                await _send_json(browser_ws, {"type": "error", "message": msg})
            else:
                logger.debug("Unhandled event: %s", evt_type)

    except websockets.exceptions.ConnectionClosed:
        logger.info("Browser WebSocket closed (VL→browser)")
    except Exception as exc:
        logger.exception("Error in voicelive→browser loop")
        await _send_json(browser_ws, {"type": "error", "message": str(exc)})


async def handle_connection(browser_ws) -> None:
    """Handle a single browser WebSocket connection."""
    logger.info("New browser connection")

    credential = DefaultAzureCredential()
    try:
        session_config = RequestSession(
            model=MODEL,
            modalities=[Modality.AUDIO, Modality.TEXT],
            instructions=SYSTEM_PROMPT,
            voice=AzureStandardVoice(name=VOICE_NAME),
            input_audio_format=InputAudioFormat.PCM16,
            output_audio_format=OutputAudioFormat.PCM16,
            input_audio_transcription={"model": "whisper-1"},
            turn_detection=ServerVad(),
        )

        async with voicelive_connect(
            endpoint=ENDPOINT,
            credential=credential,
            model=MODEL,
        ) as vl_conn:
            # Configure the session
            await vl_conn.session.update(session=session_config)
            await _send_json(browser_ws, {"type": "status", "status": "listening"})
            logger.info("VoiceLive session established")

            # Run both directions concurrently
            b2v = asyncio.create_task(_browser_to_voicelive(browser_ws, vl_conn))
            v2b = asyncio.create_task(_voicelive_to_browser(browser_ws, vl_conn))

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
    logger.info("Endpoint: %s  Model: %s  Voice: %s", ENDPOINT, MODEL, VOICE_NAME)

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
