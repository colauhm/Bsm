import aiomysql
from fastapi import APIRouter, Cookie, Header
from typing import Annotated
from pydantic import BaseModel
from typing import Optional
from ..database.query import execute_sql_query
from ..controllers.session import getSessionData
from datetime import datetime, timedelta

router = APIRouter(prefix="/api")

@router.get('/getData')
async def getData(conn, label, tank, time_unit):
    sql = """
    WITH ranked AS (
        SELECT 
            d.*,
            ROW_NUMBER() OVER (ORDER BY d.time DESC) AS rn
        FROM data d
        WHERE d.label = %s
          AND d.tank  = %s
    )
    SELECT *
    FROM ranked
    WHERE (
            (%s = 'min'  AND rn <= 30)
         OR (%s = 'hour' AND (rn - 1) % 60 = 0 AND rn <= 60*30)
         OR (%s = 'day'  AND (rn - 1) % 1440 = 0 AND rn <= 1440*30)
          )
    ORDER BY time DESC;
    """

    async with conn.cursor(aiomysql.DictCursor) as cur:
        await cur.execute(sql, (label, tank, time_unit, time_unit, time_unit))
        rows = await cur.fetchall()

    # 🔧 후처리: 30개 미만이면 마지막 값으로 채움
    if rows:
        while len(rows) < 30:
            rows.append(rows[-1])
    else:
        rows = [None] * 30  # 데이터 자체가 없을 때

    return rows
