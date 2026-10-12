from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from src import schemas
from src.database import get_connection

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

NOT_FOUND = HTTPException(status_code=404, detail="Workspace not found")


@router.post("", response_model=schemas.Workspace, status_code=status.HTTP_201_CREATED)
async def create_workspace(body: schemas.WorkspaceCreate, conn: asyncpg.Connection = Depends(get_connection)):
    row = await conn.fetchrow(
        "INSERT INTO workspaces (name, tickers, chart) VALUES ($1, $2, $3) RETURNING *",
        body.name,
        body.tickers,
        body.chart and body.chart.model_dump(mode="json"),
    )
    return dict(row)


@router.get("", response_model=list[schemas.Workspace])
async def list_workspaces(conn: asyncpg.Connection = Depends(get_connection)):
    return [dict(row) for row in await conn.fetch("SELECT * FROM workspaces ORDER BY created_at DESC")]


@router.get("/{workspace_id}", response_model=schemas.Workspace)
async def get_workspace(workspace_id: UUID, conn: asyncpg.Connection = Depends(get_connection)):
    row = await conn.fetchrow("SELECT * FROM workspaces WHERE id = $1", workspace_id)
    if row is None:
        raise NOT_FOUND
    return dict(row)


@router.patch("/{workspace_id}", response_model=schemas.Workspace)
async def update_workspace(
    workspace_id: UUID, body: schemas.WorkspaceUpdate, conn: asyncpg.Connection = Depends(get_connection)
):
    # Only the fields sent are updated; the column names come from the model, not the request.
    values = body.model_dump(mode="json", exclude_unset=True)
    if values:
        assignments = ", ".join(f"{column} = ${i}" for i, column in enumerate(values, start=2))
        assignments += ", updated_at = NOW()"
        query = f"UPDATE workspaces SET {assignments} WHERE id = $1 RETURNING *"
    else:
        query = "SELECT * FROM workspaces WHERE id = $1"
    row = await conn.fetchrow(query, workspace_id, *values.values())
    if row is None:
        raise NOT_FOUND
    return dict(row)


@router.get("/{workspace_id}/notes", response_model=list[schemas.Note])
async def list_notes(workspace_id: UUID, conn: asyncpg.Connection = Depends(get_connection)):
    rows = await conn.fetch("SELECT * FROM notes WHERE workspace_id = $1 ORDER BY at, created_at", workspace_id)
    return [dict(row) for row in rows]


@router.post("/{workspace_id}/notes", response_model=schemas.Note, status_code=status.HTTP_201_CREATED)
async def create_note(workspace_id: UUID, body: schemas.NoteCreate, conn: asyncpg.Connection = Depends(get_connection)):
    try:
        row = await conn.fetchrow(
            "INSERT INTO notes (workspace_id, content, at) VALUES ($1, $2, $3) RETURNING *",
            workspace_id,
            body.content,
            body.at,
        )
    except asyncpg.ForeignKeyViolationError as e:
        raise NOT_FOUND from e
    return dict(row)
