from .core import users_collection
from bson import ObjectId
import os
from datetime import datetime, timedelta
import hashlib
import secrets
from auth.schemas import SignupRequest
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt


# hashing (prefer passlib if available)
try:
    from passlib.context import CryptContext

    _pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    hash_password = lambda p: _pwd_ctx.hash(p)
    verify_password = lambda p, h: _pwd_ctx.verify(p, h)
except Exception:
    def hash_password(p):
        return hashlib.sha256(p.encode()).hexdigest()
    def verify_password(p, h):
        return hashlib.sha256(p.encode()).hexdigest() == h

# jwt (pyjwt)
try:
    import jwt
except Exception:
    jwt = None

JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXP_MIN = int(os.getenv("JWT_EXP_MIN", "60"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
RESET_TOKEN_HOURS = int(os.getenv("RESET_TOKEN_HOURS", "1"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login-swagger")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return user_id

def create_user(req: SignupRequest) -> str:
    col = users_collection()
    if col.find_one({"email": req.email.lower()}):
        raise ValueError("User with this email already exists")
    hashed = hash_password(req.password)
    doc = {
        "email": req.email.lower(),
        "password": hashed,
        "name": req.name,
        "age": req.age,
        "interests": req.interests,
        "goals": req.goals,
        "learning_pace": req.learning_pace,
        "created_at": datetime.utcnow(),
        # containers for tokens
        "refresh_tokens": [],  # list of {token_hash, jti, expires_at, created_at}
        "reset": None,         # {token_hash, expires_at}
    }
    res = col.insert_one(doc)
    return str(res.inserted_id)

def get_user_by_email(email: str):
    col = users_collection()
    doc = col.find_one({"email": email})
    if not doc:
        return None
    return {
        "id": str(doc.get("_id")),
        "email": doc.get("email"),
        "password": doc.get("password"),
        "full_name": doc.get("name"),
        "_raw": doc,
    }

def get_user_by_id(user_id: str):
    col = users_collection()
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    doc = col.find_one({"_id": oid})
    if not doc:
        return None
    return {
        "id": str(doc.get("_id")),
        "email": doc.get("email"),
        "password": doc.get("password"),
        "full_name": doc.get("full_name"),
        "_raw": doc,
    }

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user["password"]):
        return None
    return user

def create_access_token(data: dict, expires_minutes: int = JWT_EXP_MIN):
    if jwt is None:
        raise RuntimeError("pyjwt is required for token generation")
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)
    # pyjwt returns str in modern versions
    print(token)
    if token is None:
        return "Tokennotworking"
    return token

# ---------------- Refresh token helpers ----------------
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def create_refresh_token_for_user(user_id: str, days: int = REFRESH_TOKEN_DAYS) -> str:
    col = users_collection()
    jti = secrets.token_hex(8)
    token = secrets.token_urlsafe(64)
    token_hash = _hash_token(token)
    now = datetime.utcnow()
    expires_at = now + timedelta(days=days)
    entry = {
        "jti": jti,
        "token_hash": token_hash,
        "created_at": now,
        "expires_at": expires_at,
    }
    # push to user's refresh_tokens array
    col.update_one({"_id": ObjectId(user_id)}, {"$push": {"refresh_tokens": entry}})
    return token

def verify_refresh_token_and_rotate(refresh_token: str) -> Optional[dict]:
    """
    Verify a refresh token, rotate it (remove old, add new), and return new tokens payload:
    { user_id, access_token, refresh_token }
    """
    col = users_collection()
    token_hash = _hash_token(refresh_token)
    now = datetime.utcnow()
    # find user with matching token hash and not expired
    doc = col.find_one({"refresh_tokens.token_hash": token_hash})
    if not doc:
        return None
    # find the token entry and check expiry
    entries = doc.get("refresh_tokens", [])
    matched = None
    for e in entries:
        if e.get("token_hash") == token_hash:
            matched = e
            break
    if not matched:
        return None
    if matched.get("expires_at") and matched["expires_at"] < now:
        # expired - remove it
        col.update_one({"_id": doc["_id"]}, {"$pull": {"refresh_tokens": {"token_hash": token_hash}}})
        return None

    user_id = str(doc["_id"])
    # rotate: remove matched entry, create new refresh token
    col.update_one({"_id": doc["_id"]}, {"$pull": {"refresh_tokens": {"token_hash": token_hash}}})
    new_refresh = create_refresh_token_for_user(user_id)
    # create access token
    access = create_access_token({"sub": user_id, "email": doc.get("email")})
    return {"user_id": user_id, "access_token": access, "refresh_token": new_refresh}

def revoke_refresh_token(refresh_token: str) -> bool:
    col = users_collection()
    token_hash = _hash_token(refresh_token)
    result = col.update_one({}, {"$pull": {"refresh_tokens": {"token_hash": token_hash}}})
    return result.modified_count > 0

# ---------------- Password reset helpers ----------------
def create_password_reset_token(email: str) -> str:
    col = users_collection()
    doc = col.find_one({"email": email})
    if not doc:
        # Do not reveal user existence; return dummy token (caller should still send success)
        return ""
    token = secrets.token_urlsafe(48)
    token_hash = _hash_token(token)
    expires_at = datetime.utcnow() + timedelta(hours=RESET_TOKEN_HOURS)
    reset_obj = {"token_hash": token_hash, "expires_at": expires_at}
    col.update_one({"_id": doc["_id"]}, {"$set": {"reset": reset_obj}})
    return token

def verify_reset_token(token: str) -> Optional[str]:
    col = users_collection()
    token_hash = _hash_token(token)
    now = datetime.utcnow()
    doc = col.find_one({"reset.token_hash": token_hash})
    if not doc:
        return None
    reset = doc.get("reset") or {}
    if reset.get("expires_at") and reset["expires_at"] < now:
        # clear expired
        col.update_one({"_id": doc["_id"]}, {"$unset": {"reset": ""}})
        return None
    return str(doc["_id"])

def confirm_password_reset(token: str, new_password: str) -> bool:
    user_id = verify_reset_token(token)
    if not user_id:
        return False
    col = users_collection()
    hashed = hash_password(new_password)
    # update password and clear reset tokens and refresh tokens (force re-login)
    col.update_one({"_id": ObjectId(user_id)}, {"$set": {"password": hashed}, "$unset": {"reset": ""}, "$set": {"refresh_tokens": []}})
    return True

# placeholder email sender
def send_email_placeholder(to_email: str, subject: str, body: str):
    # integrate SMTP or external provider here
    print(f"[Email] To: {to_email} Subject: {subject}\n{body}")