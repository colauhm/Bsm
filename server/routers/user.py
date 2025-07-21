from fastapi import APIRouter, Response, Depends, Header
from pydantic import BaseModel
from typing import Annotated
from ..database.query import execute_sql_query
from typing import Optional
from ..controllers.session import createSession, getSessionData
from datetime import datetime
import hashlib

router = APIRouter(prefix="/api")

@router.get('/checkSession')
async def checkSession(session: Annotated[str, Header()] = None):
    try:
        session_data = await getSessionData(session)
        if not session_data:
            return False
        return session_data
    except Exception as e:
        return 500, "서버 오류"


@router.get('/checkId')
async def checkId(id: str):
    try:
        res = await execute_sql_query(
            "SELECT * FROM user WHERE id = %s", (id,))
        if len(res) != 0:
            return 401, "중복된 아이디가 있습니다."
        else:
            return 200, {"message": "중복된 아이디가 없습니다."}
    except Exception as e:
        return 500, "서버 오류"

# 닉네임 중복 확인


@router.get('/checkNickname')
async def checkNickname(nickname: str):
    try:
        res = await execute_sql_query(
            "SELECT * FROM user WHERE nickname = %s", (nickname,))
        if len(res) != 0:
            return 401, "중복된 닉네임이 있습니다."
        else:
            return 200, {"message": "중복된 닉네임이 없습니다."}
    except Exception as e:
        return 500, "서버 오류"
    
@router.get('/checkEmail')
async def checkEmail(email: str):
    try:
        res = await execute_sql_query(
            "SELECT * FROM user WHERE email = %s", (email,))
        if len(res) != 0:
            return 401, "중복된 email이 있습니다."
        else:
            return 200, {"message": "중복된 email이 없습니다."}
    except Exception as e:
        return 500, "서버 오류"
    
@router.get('/checkPower')
async def checkPower(id:Optional[str]):
    try:
        res = await execute_sql_query(
            "SELECT * FROM user WHERE idx = %s", (id,))
        
        if len(res) == 0:
            return 401, "권한없음"
        else:
            return res[0]['power']
    except Exception as e:
        return 500, "서버 오류"
    
     
class Signup(BaseModel):
    id:str
    password:str
    nickname:str
    email:str

class Login(BaseModel):
    id: str
    password: str

@router.post('/signup')
async def signup(data:Signup):
    try:
        today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        res = await execute_sql_query(
            "SELECT * FROM user WHERE id = %s", (data.id,))
        if len(res) != 0:
            return 401, "중복된 아이디가 있습니다."
        else:
            await execute_sql_query("INSERT INTO user (email, id, password, nickname, createdAt) VALUES (%s, %s, %s, %s, %s)",
                                    (data.email, data.id, hashlib.sha256(data.password.encode()).hexdigest(), data.nickname, today))
            return 200, {"message": "signup success"}
        
    except Exception as e:
        print(e)
        return 500, "서버오류" 
    
@router.post("/login")
async def login(data: Login, response: Response):
    # print(data.id, data.password)
    try:
        res = await execute_sql_query(
            "SELECT * FROM user WHERE id = %s and password = %s", (data.id, hashlib.sha256(data.password.encode()).hexdigest()))
        if len(res) == 0:
            return 401, {"message": "login fail"}
        else:
            userInfo = res[0]
            sessionId = await createSession(
                userInfo['email'], userInfo['id'], userInfo['nickname'], userInfo['idx'], userInfo['power'])
            return 200, sessionId
    except Exception as e:
        print(e)
        return 500, "서버 오류" ,res[0]
