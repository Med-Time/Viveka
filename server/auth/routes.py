from fastapi import APIRouter, HTTPException, status, Depends
from .schemas import (
    SignupRequest, LoginRequest, TokenResponse, UserOut,
    PasswordResetRequest, PasswordResetConfirm,
    RefreshRequest, RefreshResponse, LogoutRequest
)
from . import services
from typing import Dict

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", status_code=201)
def signup(req: SignupRequest):
    try:
        user_id = services.create_user(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": user_id, "email": req.email.lower(), "name": req.name}

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    user = services.authenticate_user(req.email.lower(), req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = services.create_access_token({"sub": user["id"], "email": user["email"]})
    # create refresh token and store
    refresh = services.create_refresh_token_for_user(user["id"])
    
    user_out = UserOut(id=user["id"], email=user["email"], full_name=user.get("full_name"), studies=user.get("studies"))
    return TokenResponse(access_token=token, user=user_out), {"refresh_token": refresh}

# NOTE: above login returned a tuple; better to return combined response
# @router.post("/login2", response_model=RefreshResponse)
# def login2(req: LoginRequest):
#     user = services.authenticate_user(req.email.lower(), req.password)
#     if not user:
#         raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
#     access = services.create_access_token({"sub": user["id"], "email": user["email"]})
#     refresh = services.create_refresh_token_for_user(user["id"])
#     return RefreshResponse(access_token=access, refresh_token=refresh)

# Refresh endpoint - rotates refresh token and returns new access+refresh
@router.post("/refresh", response_model=RefreshResponse)
def refresh(req: RefreshRequest):
    result = services.verify_refresh_token_and_rotate(req.refresh_token)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return RefreshResponse(access_token=result["access_token"], refresh_token=result["refresh_token"])

# Logout (revoke refresh token)
@router.post("/logout", status_code=204)
def logout(req: LogoutRequest):
    revoked = services.revoke_refresh_token(req.refresh_token)
    if not revoked:
        # still return 204 for idempotency
        return None
    return None

# Password reset - request token (email sending is placeholder)
@router.post("/reset/request", status_code=200)
def password_reset_request(req: PasswordResetRequest):
    token = services.create_password_reset_token(req.email.lower())
    if token:
        # send email with reset link (placeholder), in production send actual email
        reset_link = f"https://your.app/reset?token={token}"
        services.send_email_placeholder(req.email.lower(), "Password reset", f"Use this link to reset your password: {reset_link}")
    # Always return success to avoid user enumeration
    return {"msg": "If an account with that email exists, a password reset link has been sent."}

@router.post("/reset/confirm", status_code=200)
def password_reset_confirm(req: PasswordResetConfirm):
    ok = services.confirm_password_reset(req.token, req.new_password)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    return {"msg": "Password has been reset. Please login with your new password."}