from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
import bcrypt
import secrets

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

router = APIRouter()
supabase_service = SupabaseService()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    user: Optional[dict] = None
    token: Optional[str] = None


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))


def generate_token() -> str:
    return secrets.token_urlsafe(32)


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    
    try:
        if len(request.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long"
            )

        existing_user = supabase_service.get_user_by_email(request.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        password_hash = hash_password(request.password)

        user = supabase_service.create_user(
            email=request.email,
            name=request.name,
            password_hash=password_hash
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )

        token = generate_token()

        return AuthResponse(
            success=True,
            message="User registered successfully",
            user={
                "id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "role": user.get("role", "user")
            },
            token=token
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Signup error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signup failed: {str(e)}"
        )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    try:
        user = supabase_service.get_user_by_email(request.email)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        stored_password_hash = user.get("password_hash")

        if not stored_password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Please reset your password. This account was created before password feature was added."
            )

        if not verify_password(request.password, stored_password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        token = generate_token()

        print(f"✓ Login successful for user: {user.get('email')}")

        return AuthResponse(
            success=True,
            message="Login successful",
            user={
                "id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "role": user.get("role", "user")
            },
            token=token
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Login error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.get("/user/{email}")
async def get_user(email: str):

    try:
        user = supabase_service.get_user_by_email(email)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return {
            "success": True,
            "user": {
                "id": user.get("id"),
                "email": user.get("email"),
                "name": user.get("name"),
                "role": user.get("role", "user")
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user: {str(e)}"
        )
