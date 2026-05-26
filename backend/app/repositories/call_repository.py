from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.call_session import CallSession, CallStatus


class CallRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, call: CallSession) -> CallSession:
        self.session.add(call)
        await self.session.flush()
        await self.session.refresh(call)
        return call

    async def get_by_room_key(self, room_key: str) -> CallSession | None:
        result = await self.session.execute(
            select(CallSession).where(CallSession.room_key == room_key)
        )
        return result.scalar_one_or_none()

    async def get_active_for_user(self, user_id: UUID) -> CallSession | None:
        """Return any ringing or active call involving this user."""
        result = await self.session.execute(
            select(CallSession).where(
                or_(CallSession.caller_id == user_id, CallSession.callee_id == user_id),
                CallSession.status.in_([CallStatus.RINGING, CallStatus.ACTIVE]),
            )
        )
        return result.scalar_one_or_none()

    async def update_status(self, call_id: UUID, status: CallStatus) -> None:
        result = await self.session.execute(select(CallSession).where(CallSession.id == call_id))
        call = result.scalar_one_or_none()
        if call:
            call.status = status
            await self.session.flush()
