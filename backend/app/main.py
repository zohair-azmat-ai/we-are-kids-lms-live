from collections.abc import Iterable
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    api_router,
    cleanup_expired_recordings,
    get_live_or_scheduled_class,
    mark_class_as_ended,
    set_class_participants_count,
)
from app.config import CORS_ORIGINS, ENV, PORT, UPLOAD_DIR


app = FastAPI(
    title="School LMS Live API",
    version="1.0.0",
    description="Backend service for the School LMS Live MVP.",
)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["root"])
def read_root() -> dict:
    return {
        "name": "School LMS Live API",
        "status": "running",
        "environment": ENV,
        "port": PORT,
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
def read_health() -> dict:
    return {
        "status": "healthy",
        "service": "backend",
        "version": "1.0.0",
        "environment": ENV,
        "port": PORT,
    }


app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def handle_startup() -> None:
    cleanup_expired_recordings()


RTCMessage = dict[str, object]
room_connections: dict[str, dict[str, WebSocket]] = {}
room_participants: dict[str, dict[str, dict[str, str]]] = {}


def get_room_participants(class_id: str) -> list[dict[str, str]]:
    return list(room_participants.get(class_id, {}).values())


def update_classroom_participant_count(class_id: str) -> None:
    participants = room_participants.get(class_id, {})
    set_class_participants_count(class_id, len(participants))


async def send_json(websocket: WebSocket, payload: RTCMessage) -> None:
    await websocket.send_json(payload)


async def broadcast(
    class_id: str,
    payload: RTCMessage,
    exclude_participant_ids: Iterable[str] | None = None,
) -> None:
    excluded_ids = set(exclude_participant_ids or [])
    sockets = room_connections.get(class_id, {})

    for participant_id, connection in list(sockets.items()):
        if participant_id in excluded_ids:
            continue

        await send_json(connection, payload)


async def relay_to_participant(
    class_id: str,
    participant_id: str,
    payload: RTCMessage,
) -> None:
    target_connection = room_connections.get(class_id, {}).get(participant_id)

    if target_connection:
        await send_json(target_connection, payload)


def remove_participant(class_id: str, participant_id: str) -> dict[str, str] | None:
    participant = room_participants.get(class_id, {}).pop(participant_id, None)
    room_connections.get(class_id, {}).pop(participant_id, None)

    if room_participants.get(class_id) == {}:
        room_participants.pop(class_id, None)

    if room_connections.get(class_id) == {}:
        room_connections.pop(class_id, None)

    update_classroom_participant_count(class_id)
    return participant


@app.websocket("/ws/classroom/{class_id}")
async def classroom_websocket(websocket: WebSocket, class_id: str) -> None:
    await websocket.accept()

    participant_id: str | None = None
    participant: dict[str, str] | None = None
    room_end_requested = False

    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")

            if message_type == "join":
                requested_role = str(message.get("role", ""))
                current_session = get_live_or_scheduled_class(class_id)

                if not current_session:
                    await send_json(
                        websocket,
                        {
                            "type": "error",
                            "message": "No class session found for this room.",
                        },
                    )
                    await websocket.close()
                    return

                if requested_role == "student" and current_session.status != "live":
                    await send_json(
                        websocket,
                        {
                            "type": "error",
                            "message": "No live session found right now.",
                        },
                    )
                    await websocket.close()
                    return

                participant_id = uuid4().hex
                participant = {
                    "participant_id": participant_id,
                    "name": str(message.get("name", "Participant")),
                    "email": str(message.get("email", "")),
                    "role": requested_role,
                }

                room_connections.setdefault(class_id, {})[participant_id] = websocket
                room_participants.setdefault(class_id, {})[participant_id] = participant
                update_classroom_participant_count(class_id)

                await send_json(
                    websocket,
                    {
                        "type": "joined",
                        "participant_id": participant_id,
                        "participants": get_room_participants(class_id),
                    },
                )

                await broadcast(
                    class_id,
                    {
                        "type": "participant-joined",
                        "participant": participant,
                    },
                    exclude_participant_ids=[participant_id],
                )
                continue

            if not participant_id or not participant:
                await send_json(
                    websocket,
                    {
                        "type": "error",
                        "message": "Join the room before sending signaling messages.",
                    },
                )
                continue

            if message_type in {"offer", "answer", "ice-candidate"}:
                target_id = str(message.get("target_id", ""))

                if not target_id:
                    continue

                await relay_to_participant(
                    class_id,
                    target_id,
                    {
                        "type": message_type,
                        "sender_id": participant_id,
                        "sender": participant,
                        "data": message.get("data"),
                    },
                )
                continue

            if message_type == "end-class" and participant.get("role") == "teacher":
                room_end_requested = True
                mark_class_as_ended(class_id)
                await broadcast(
                    class_id,
                    {
                        "type": "room-ended",
                        "message": "The teacher ended this class session.",
                    },
                    exclude_participant_ids=[participant_id],
                )
                break
    except WebSocketDisconnect:
        pass
    finally:
        if participant_id:
            removed_participant = remove_participant(class_id, participant_id)

            if removed_participant:
                if removed_participant.get("role") == "teacher":
                    mark_class_as_ended(class_id)
                    if not room_end_requested:
                        await broadcast(
                            class_id,
                            {
                                "type": "room-ended",
                                "message": "The teacher disconnected and the class ended.",
                            },
                        )
                else:
                    await broadcast(
                        class_id,
                        {
                            "type": "participant-left",
                            "participant_id": participant_id,
                        },
                    )
