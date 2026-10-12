import json
from collections.abc import AsyncGenerator

import asyncpg

from src.config import settings

pool: asyncpg.Pool | None = None


async def _init_connection(connection: asyncpg.Connection) -> None:
    # Read and write JSONB columns as Python objects rather than strings.
    await connection.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def get_connection() -> AsyncGenerator[asyncpg.Connection]:
    # Created on first use so the stock endpoints still work when postgres isn't running.
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=10, init=_init_connection)
    async with pool.acquire() as connection:
        yield connection


async def close_pool() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None
